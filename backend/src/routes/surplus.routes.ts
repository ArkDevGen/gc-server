import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/surplus — search available surplus
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.query.item_id as string;
    const locationId = req.query.location_id as string;
    const search = req.query.search as string;

    let sql = `SELECT sp.*, i.name as item_name, i.sku, i.unit_of_measure,
               l.name as location_name, b.build_number, b.name as build_name,
               u.display_name as captured_by_name
               FROM surplus_pool sp
               JOIN items i ON sp.item_id = i.id
               JOIN locations l ON sp.location_id = l.id
               LEFT JOIN builds b ON sp.build_id = b.id
               LEFT JOIN users u ON sp.captured_by = u.id
               WHERE sp.is_active = true`;
    const params: any[] = [];
    let idx = 1;

    if (itemId) { sql += ` AND sp.item_id = $${idx}`; params.push(itemId); idx++; }
    if (locationId) { sql += ` AND sp.location_id = $${idx}`; params.push(locationId); idx++; }
    if (search) { sql += ` AND (i.name ILIKE $${idx} OR i.sku ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    sql += ' ORDER BY sp.captured_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/surplus/summary — grouped by item
router.get('/summary', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT i.id as item_id, i.name as item_name, i.sku, i.unit_of_measure,
             SUM(sp.qty_available) as total_available,
             COUNT(sp.id) as pool_count,
             AVG(sp.original_cost) as avg_cost
      FROM surplus_pool sp
      JOIN items i ON sp.item_id = i.id
      WHERE sp.is_active = true
      GROUP BY i.id, i.name, i.sku, i.unit_of_measure
      ORDER BY total_available DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
