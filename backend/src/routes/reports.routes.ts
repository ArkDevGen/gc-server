import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';

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
        v.name as vendor_name, v.website as vendor_website,
        COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN item_locations il ON il.item_id = i.id
      LEFT JOIN vendors v ON i.preferred_vendor_id = v.id
      WHERE i.is_active = true AND i.reorder_point > 0
      GROUP BY i.id, c.name, v.name, v.website
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

// GET /api/reports/accounts-receivable — what customers owe (unpaid invoices)
router.get('/accounts-receivable', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT inv.id, inv.invoice_number, inv.invoice_date, inv.due_date, inv.total, inv.status,
        c.name as customer_name, c.id as customer_id,
        EXTRACT(DAY FROM NOW() - inv.invoice_date) as days_outstanding,
        CASE
          WHEN inv.due_date IS NULL OR inv.due_date >= CURRENT_DATE THEN 'current'
          WHEN CURRENT_DATE - inv.due_date <= 30 THEN '1_30'
          WHEN CURRENT_DATE - inv.due_date <= 60 THEN '31_60'
          WHEN CURRENT_DATE - inv.due_date <= 90 THEN '61_90'
          ELSE '90_plus'
        END as aging_bucket
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      WHERE inv.status NOT IN ('paid', 'voided')
      ORDER BY inv.due_date ASC NULLS LAST
    `);

    // Summary by customer
    const summary = await query(`
      SELECT c.id, c.name,
        COUNT(inv.id) as invoice_count,
        COALESCE(SUM(inv.total), 0) as total_owed,
        COALESCE(SUM(CASE WHEN inv.due_date IS NULL OR inv.due_date >= CURRENT_DATE THEN inv.total ELSE 0 END), 0) as current_amount,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - inv.due_date BETWEEN 1 AND 30 THEN inv.total ELSE 0 END), 0) as days_1_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - inv.due_date BETWEEN 31 AND 60 THEN inv.total ELSE 0 END), 0) as days_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - inv.due_date BETWEEN 61 AND 90 THEN inv.total ELSE 0 END), 0) as days_61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - inv.due_date > 90 THEN inv.total ELSE 0 END), 0) as days_90_plus
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      WHERE inv.status NOT IN ('paid', 'voided')
      GROUP BY c.id, c.name
      ORDER BY total_owed DESC
    `);

    const totals = await query(`
      SELECT COALESCE(SUM(total), 0) as total_ar,
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN total ELSE 0 END), 0) as total_overdue
      FROM invoices WHERE status NOT IN ('paid', 'voided')
    `);

    res.json({ invoices: result.rows, by_customer: summary.rows, totals: totals.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/accounts-payable — what we owe vendors (open POs)
router.get('/accounts-payable', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT po.id, po.po_number, po.order_date, po.expected_date, po.total, po.status,
        v.name as vendor_name, v.id as vendor_id,
        EXTRACT(DAY FROM NOW() - po.order_date) as days_outstanding,
        CASE
          WHEN po.expected_date IS NULL OR po.expected_date >= CURRENT_DATE THEN 'current'
          WHEN CURRENT_DATE - po.expected_date <= 30 THEN '1_30'
          WHEN CURRENT_DATE - po.expected_date <= 60 THEN '31_60'
          WHEN CURRENT_DATE - po.expected_date <= 90 THEN '61_90'
          ELSE '90_plus'
        END as aging_bucket
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.status NOT IN ('received', 'cancelled')
      ORDER BY po.order_date ASC
    `);

    // Summary by vendor
    const summary = await query(`
      SELECT v.id, v.name,
        COUNT(po.id) as po_count,
        COALESCE(SUM(po.total), 0) as total_owed,
        COALESCE(SUM(CASE WHEN po.expected_date IS NULL OR po.expected_date >= CURRENT_DATE THEN po.total ELSE 0 END), 0) as current_amount,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - po.expected_date BETWEEN 1 AND 30 THEN po.total ELSE 0 END), 0) as days_1_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - po.expected_date BETWEEN 31 AND 60 THEN po.total ELSE 0 END), 0) as days_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - po.expected_date BETWEEN 61 AND 90 THEN po.total ELSE 0 END), 0) as days_61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - po.expected_date > 90 THEN po.total ELSE 0 END), 0) as days_90_plus
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.status NOT IN ('received', 'cancelled')
      GROUP BY v.id, v.name
      ORDER BY total_owed DESC
    `);

    const totals = await query(`
      SELECT COALESCE(SUM(total), 0) as total_ap,
        COUNT(*) as total_pos,
        COALESCE(SUM(CASE WHEN expected_date IS NOT NULL AND expected_date < CURRENT_DATE THEN total ELSE 0 END), 0) as total_overdue
      FROM purchase_orders WHERE status NOT IN ('received', 'cancelled')
    `);

    res.json({ purchase_orders: result.rows, by_vendor: summary.rows, totals: totals.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/reorder-suggestions — auto-calculated reorder points
router.get('/reorder-suggestions', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Calculate average daily usage over last 90 days from inventory_adjustments
    // Only count outgoing adjustments: build_usage, sale, transfer_out
    const result = await query(`
      SELECT i.id, i.sku, i.name, i.unit_of_measure, i.reorder_point as current_reorder_point,
        i.reorder_qty, i.lead_time_days as item_lead_time, i.safety_stock_days,
        v.name as vendor_name, v.lead_time_days as vendor_lead_time, v.website as vendor_website,
        c.name as category_name,
        COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand,
        usage.total_used_90d,
        usage.avg_daily_usage,
        COALESCE(i.lead_time_days, v.lead_time_days, 7) as effective_lead_time,
        COALESCE(i.safety_stock_days, 7) as effective_safety_days
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN vendors v ON i.preferred_vendor_id = v.id
      LEFT JOIN item_locations il ON il.item_id = i.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(ABS(ia.qty_change)), 0) as total_used_90d,
          CASE
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(ABS(ia.qty_change)), 0) / 90.0
            ELSE 0
          END as avg_daily_usage
        FROM inventory_adjustments ia
        WHERE ia.item_id = i.id
          AND ia.qty_change < 0
          AND ia.reason IN ('build_usage', 'sale', 'transfer_out')
          AND ia.created_at >= NOW() - INTERVAL '90 days'
      ) usage ON true
      WHERE i.is_active = true
      GROUP BY i.id, c.name, v.name, v.lead_time_days, v.website,
        usage.total_used_90d, usage.avg_daily_usage
      ORDER BY usage.avg_daily_usage DESC NULLS LAST
    `);

    // Calculate suggested reorder point for each item
    const suggestions = result.rows.map((item: any) => {
      const avgDaily = parseFloat(item.avg_daily_usage) || 0;
      const leadTime = parseInt(item.effective_lead_time) || 7;
      const safetyDays = parseInt(item.effective_safety_days) || 7;

      // Reorder Point = (avg daily usage × lead time) + (avg daily usage × safety days)
      const suggested = Math.ceil(avgDaily * leadTime + avgDaily * safetyDays);
      const current = item.current_reorder_point || 0;

      return {
        ...item,
        avg_daily_usage: Math.round(avgDaily * 100) / 100,
        suggested_reorder_point: suggested,
        difference: suggested - current,
        has_usage_data: avgDaily > 0,
      };
    });

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/reorder-suggestions/apply — apply suggested reorder points
router.post('/reorder-suggestions/apply', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body; // [{ id, reorder_point }]
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
      }

      let updated = 0;
      for (const item of items) {
        const result = await query(
          'UPDATE items SET reorder_point = $1 WHERE id = $2',
          [item.reorder_point, item.id]
        );
        if (result.rowCount && result.rowCount > 0) updated++;
      }

      res.json({ message: `Updated ${updated} items`, updated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/dashboard-stats — aggregated stats for dashboard
router.get('/dashboard-stats', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [items, lowStock, builds, pos, invoices, surplus, value, ar, ap] = await Promise.all([
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
      query("SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status NOT IN ('paid', 'voided')"),
      query("SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders WHERE status NOT IN ('received', 'cancelled')"),
    ]);

    res.json({
      total_items: parseInt(items.rows[0].count),
      low_stock_items: parseInt(lowStock.rows[0].count),
      active_builds: parseInt(builds.rows[0].count),
      open_pos: parseInt(pos.rows[0].count),
      unpaid_invoices: parseInt(invoices.rows[0].count),
      surplus_value: parseFloat(surplus.rows[0].value),
      inventory_value: parseFloat(value.rows[0].total),
      accounts_receivable: parseFloat(ar.rows[0].total),
      accounts_payable: parseFloat(ap.rows[0].total),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
