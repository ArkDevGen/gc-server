import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/reports/inventory-summary
router.get('/inventory-summary', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT i.id, i.sku, i.name, i.item_type, i.unit_of_measure,
        i.cost_price, i.sell_price, i.reorder_point,
        c.name as category_name,
        COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand,
        COALESCE(SUM(il.qty_reserved), 0) as total_reserved,
        COALESCE(SUM(il.qty_available), 0) as total_available,
        COALESCE(SUM(il.qty_on_hand), 0) * i.cost_price as total_cost_value,
        COALESCE(SUM(il.qty_on_hand), 0) * i.sell_price as total_sell_value,
        json_agg(json_build_object(
          'location_name', l.name, 'qty_on_hand', il.qty_on_hand,
          'qty_available', il.qty_available, 'bin_label', il.bin_label
        )) FILTER (WHERE il.id IS NOT NULL) as location_breakdown
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN item_locations il ON il.item_id = i.id
      LEFT JOIN locations l ON il.location_id = l.id
      WHERE i.is_active = true
      GROUP BY i.id, c.name
      ORDER BY i.name
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT i.id, i.sku, i.name, i.unit_of_measure, i.reorder_point, i.reorder_qty,
        c.name as category_name,
        COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN item_locations il ON il.item_id = i.id
      WHERE i.is_active = true AND i.reorder_point > 0
      GROUP BY i.id, c.name
      HAVING COALESCE(SUM(il.qty_on_hand), 0) <= i.reorder_point
      ORDER BY (COALESCE(SUM(il.qty_on_hand), 0)::float / NULLIF(i.reorder_point, 0)) ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/build-variance
router.get('/build-variance', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT b.id, b.build_number, b.name, b.status,
        c.name as customer_name,
        b.budget_total, b.actual_total,
        (b.budget_total - b.actual_total) as variance,
        CASE WHEN b.budget_total > 0
          THEN ROUND(((b.budget_total - b.actual_total) / b.budget_total * 100)::numeric, 1)
          ELSE 0 END as variance_pct,
        (SELECT COALESCE(SUM(bm.qty_surplus * bm.unit_cost), 0)
         FROM build_materials bm WHERE bm.build_id = b.id) as surplus_value,
        b.start_date, b.actual_end_date
      FROM builds b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.status = 'complete'
      ORDER BY b.actual_end_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/inventory-value
router.get('/inventory-value', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT l.id, l.name as location_name, l.location_type,
        COUNT(DISTINCT il.item_id) as item_count,
        COALESCE(SUM(il.qty_on_hand), 0) as total_qty,
        COALESCE(SUM(il.qty_on_hand * i.cost_price), 0) as cost_value,
        COALESCE(SUM(il.qty_on_hand * i.sell_price), 0) as sell_value
      FROM locations l
      LEFT JOIN item_locations il ON il.location_id = l.id AND il.qty_on_hand > 0
      LEFT JOIN items i ON il.item_id = i.id
      WHERE l.is_active = true
      GROUP BY l.id
      ORDER BY cost_value DESC
    `);

    const totals = await query(`
      SELECT COUNT(DISTINCT il.item_id) as total_items,
        COALESCE(SUM(il.qty_on_hand * i.cost_price), 0) as total_cost_value,
        COALESCE(SUM(il.qty_on_hand * i.sell_price), 0) as total_sell_value
      FROM item_locations il
      JOIN items i ON il.item_id = i.id
      WHERE il.qty_on_hand > 0
    `);

    res.json({ locations: result.rows, totals: totals.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/surplus-aging
router.get('/surplus-aging', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT sp.id, i.name as item_name, i.sku, i.unit_of_measure,
        l.name as location_name, b.build_number, b.name as build_name,
        sp.qty_available, sp.original_cost,
        sp.qty_available * COALESCE(sp.original_cost, 0) as total_value,
        sp.captured_at,
        EXTRACT(DAY FROM NOW() - sp.captured_at) as days_aged,
        sp.condition_notes
      FROM surplus_pool sp
      JOIN items i ON sp.item_id = i.id
      JOIN locations l ON sp.location_id = l.id
      LEFT JOIN builds b ON sp.build_id = b.id
      WHERE sp.is_active = true
      ORDER BY sp.captured_at ASC
    `);

    const summary = await query(`
      SELECT COUNT(*) as total_entries,
        COALESCE(SUM(sp.qty_available * COALESCE(sp.original_cost, 0)), 0) as total_value,
        COALESCE(AVG(EXTRACT(DAY FROM NOW() - sp.captured_at)), 0) as avg_age_days
      FROM surplus_pool sp WHERE sp.is_active = true
    `);

    res.json({ items: result.rows, summary: summary.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/dashboard-stats — aggregated stats for dashboard
router.get('/dashboard-stats', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [items, lowStock, builds, pos, invoices, surplus, value] = await Promise.all([
      query("SELECT COUNT(*) as count FROM items WHERE is_active = true"),
      query(`SELECT COUNT(*) as count FROM (
        SELECT i.id FROM items i LEFT JOIN item_locations il ON il.item_id = i.id
        WHERE i.is_active = true AND i.reorder_point > 0
        GROUP BY i.id HAVING COALESCE(SUM(il.qty_on_hand), 0) <= i.reorder_point
      ) sub`),
      query("SELECT COUNT(*) as count FROM builds WHERE status = 'active'"),
      query("SELECT COUNT(*) as count FROM purchase_orders WHERE status NOT IN ('received', 'cancelled')"),
      query("SELECT COUNT(*) as count FROM invoices WHERE status NOT IN ('paid', 'voided')"),
      query("SELECT COALESCE(SUM(qty_available * COALESCE(original_cost, 0)), 0) as value FROM surplus_pool WHERE is_active = true"),
      query(`SELECT COALESCE(SUM(il.qty_on_hand * i.cost_price), 0) as total
             FROM item_locations il JOIN items i ON il.item_id = i.id WHERE il.qty_on_hand > 0`),
    ]);

    res.json({
      total_items: parseInt(items.rows[0].count),
      low_stock_items: parseInt(lowStock.rows[0].count),
      active_builds: parseInt(builds.rows[0].count),
      open_pos: parseInt(pos.rows[0].count),
      unpaid_invoices: parseInt(invoices.rows[0].count),
      surplus_value: parseFloat(surplus.rows[0].value),
      inventory_value: parseFloat(value.rows[0].total),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
