import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { UserRole, AdjustmentReason } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { getNextNumber } from '../services/sequence.service';
import { adjustStock } from '../services/inventory.service';

const router = Router();

const createCountSchema = z.object({
  location_id: z.string().uuid(),
  description: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  filter_category_id: z.string().uuid().optional(),
  filter_aisle: z.string().optional(),
});

const recordCountSchema = z.object({
  lines: z.array(z.object({
    line_id: z.string().uuid(),
    counted_qty: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
});

// GET /api/counts
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const locationId = req.query.location_id as string;
    const assignedTo = req.query.assigned_to as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortDir = (req.query.sort_dir as string) === 'asc' ? 'ASC' : 'DESC';

    let sql = `SELECT pc.*, l.name as location_name, u.display_name as created_by_name,
               a.display_name as assigned_to_name
               FROM physical_counts pc
               JOIN locations l ON pc.location_id = l.id
               JOIN users u ON pc.created_by = u.id
               LEFT JOIN users a ON pc.assigned_to = a.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND pc.status = $${idx}`; params.push(status); idx++; }
    if (locationId) { sql += ` AND pc.location_id = $${idx}`; params.push(locationId); idx++; }
    if (assignedTo) { sql += ` AND pc.assigned_to = $${idx}`; params.push(assignedTo); idx++; }
    if (search) {
      sql += ` AND (pc.count_number ILIKE $${idx} OR pc.description ILIKE $${idx} OR l.name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSorts: Record<string, string> = {
      count_number: 'pc.count_number',
      location: 'l.name',
      assigned_to: 'a.display_name',
      total_items: 'pc.total_items',
      items_counted: 'pc.items_counted',
      items_variance: 'pc.items_variance',
      status: 'pc.status',
      date: 'pc.created_at',
      created_at: 'pc.created_at',
    };
    const sortCol = allowedSorts[sortBy] || 'pc.created_at';

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total);

    sql += ` ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/counts/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const countResult = await query(
      `SELECT pc.*, l.name as location_name, u.display_name as created_by_name,
       a.display_name as assigned_to_name
       FROM physical_counts pc
       JOIN locations l ON pc.location_id = l.id
       JOIN users u ON pc.created_by = u.id
       LEFT JOIN users a ON pc.assigned_to = a.id
       WHERE pc.id = $1`, [req.params.id]
    );
    if (countResult.rows.length === 0) return res.status(404).json({ error: 'Count not found' });

    const linesResult = await query(
      `SELECT pcl.*, i.name as item_name, i.sku, i.unit_of_measure
       FROM physical_count_lines pcl
       JOIN items i ON pcl.item_id = i.id
       WHERE pcl.count_id = $1
       ORDER BY pcl.bin_label ASC NULLS LAST, i.name`, [req.params.id]
    );

    res.json({ ...countResult.rows[0], lines: linesResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/counts — create a new count and populate lines from current inventory
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createCountSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { location_id, description, assigned_to, filter_category_id, filter_aisle } = req.body;
      const countNumber = await getNextNumber('physical_counts', 'count_number', 'CNT');

      const countResult = await client.query(
        `INSERT INTO physical_counts (count_number, location_id, description, assigned_to, filter_category_id, filter_aisle, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [countNumber, location_id, description || null, assigned_to || null,
         filter_category_id || null, filter_aisle || null, req.user!.userId]
      );
      const countId = countResult.rows[0].id;

      // Populate lines from current item_locations at this location
      let itemFilter = 'WHERE il.location_id = $1 AND i.is_active = true';
      const params: any[] = [location_id];
      let pidx = 2;

      if (filter_category_id) {
        itemFilter += ` AND i.category_id = $${pidx}`;
        params.push(filter_category_id);
        pidx++;
      }
      if (filter_aisle) {
        itemFilter += ` AND il.bin_aisle = $${pidx}`;
        params.push(filter_aisle);
        pidx++;
      }

      const itemsResult = await client.query(
        `SELECT il.id as item_location_id, il.item_id, il.qty_on_hand, il.bin_label
         FROM item_locations il
         JOIN items i ON il.item_id = i.id
         ${itemFilter}
         ORDER BY il.bin_label ASC NULLS LAST, i.name`,
        params
      );

      for (const item of itemsResult.rows) {
        await client.query(
          `INSERT INTO physical_count_lines (count_id, item_id, item_location_id, expected_qty, bin_label)
           VALUES ($1, $2, $3, $4, $5)`,
          [countId, item.item_id, item.item_location_id, parseFloat(item.qty_on_hand), item.bin_label]
        );
      }

      // Update count stats
      await client.query(
        'UPDATE physical_counts SET total_items = $1 WHERE id = $2',
        [itemsResult.rows.length, countId]
      );

      await client.query('COMMIT');
      res.status(201).json({ ...countResult.rows[0], total_items: itemsResult.rows.length });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/counts/:id/start
router.post('/:id/start', requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        "UPDATE physical_counts SET status = 'in_progress', started_at = NOW() WHERE id = $1 AND status = 'draft' RETURNING *",
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(400).json({ error: 'Count not in draft status' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/counts/:id/record — record counted quantities
router.post('/:id/record', requireAuth, validate(recordCountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const countId = req.params.id as string;
      const { lines } = req.body;

      for (const line of lines) {
        await client.query(
          `UPDATE physical_count_lines SET counted_qty = $1, is_counted = true, counted_at = NOW(), notes = COALESCE($2, notes)
           WHERE id = $3 AND count_id = $4`,
          [line.counted_qty, line.notes || null, line.line_id, countId]
        );
      }

      // Update count stats
      const stats = await client.query(`
        SELECT COUNT(*) FILTER (WHERE is_counted) as counted,
               COUNT(*) FILTER (WHERE is_counted AND variance = 0) as matched,
               COUNT(*) FILTER (WHERE is_counted AND variance != 0) as with_variance
        FROM physical_count_lines WHERE count_id = $1
      `, [countId]);

      await client.query(
        `UPDATE physical_counts SET items_counted = $1, items_matched = $2, items_variance = $3
         WHERE id = $4`,
        [parseInt(stats.rows[0].counted), parseInt(stats.rows[0].matched),
         parseInt(stats.rows[0].with_variance), countId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Counts recorded', ...stats.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/counts/:id/complete — mark as ready for review
router.post('/:id/complete', requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        "UPDATE physical_counts SET status = 'review', completed_at = NOW() WHERE id = $1 AND status = 'in_progress' RETURNING *",
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(400).json({ error: 'Count not in progress' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/counts/:id/apply — apply variances to inventory
router.post('/:id/apply', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const countId = req.params.id as string;

      const count = await client.query(
        "SELECT * FROM physical_counts WHERE id = $1 AND status = 'review'", [countId]
      );
      if (count.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Count not in review status' });
      }

      // Get lines with variances
      const lines = await client.query(
        `SELECT pcl.*, il.location_id
         FROM physical_count_lines pcl
         JOIN item_locations il ON pcl.item_location_id = il.id
         WHERE pcl.count_id = $1 AND pcl.is_counted = true AND pcl.variance != 0`,
        [countId]
      );

      let adjustments = 0;
      for (const line of lines.rows) {
        const variance = parseFloat(line.variance);
        await adjustStock({
          itemId: line.item_id,
          locationId: line.location_id,
          qtyChange: variance,
          reason: AdjustmentReason.PHYSICAL_COUNT,
          referenceType: 'count',
          referenceId: countId,
          notes: `Physical count ${count.rows[0].count_number}${line.notes ? ': ' + line.notes : ''}`,
          adjustedBy: req.user!.userId,
        });
        adjustments++;
      }

      // Update item_locations last_counted_at for all counted items
      await client.query(`
        UPDATE item_locations SET last_counted_at = NOW()
        WHERE id IN (SELECT item_location_id FROM physical_count_lines WHERE count_id = $1 AND is_counted = true)
      `, [countId]);

      await client.query(
        "UPDATE physical_counts SET status = 'applied', applied_at = NOW(), applied_by = $1 WHERE id = $2",
        [req.user!.userId, countId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Count applied', adjustments_made: adjustments });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
