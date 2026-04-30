import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { UserRole, ItemType, UnitOfMeasure, AdjustmentReason } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { adjustStock, getItemWithLocations, getAdjustmentHistory } from '../services/inventory.service';

const router = Router();

// --- Schemas ---

const createItemSchema = z.object({
  sku: z.string().max(50).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  item_type: z.nativeEnum(ItemType).default(ItemType.INVENTORY),
  category_id: z.string().uuid().optional(),
  unit_of_measure: z.nativeEnum(UnitOfMeasure).default(UnitOfMeasure.EACH),
  cost_price: z.number().min(0).default(0),
  sell_price: z.number().min(0).default(0),
  reorder_point: z.number().int().min(0).default(0),
  reorder_qty: z.number().int().min(0).default(0),
  preferred_vendor_id: z.string().uuid().optional(),
  lead_time_days: z.number().int().min(0).optional(),
});

const updateItemSchema = z.object({
  sku: z.string().max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  item_type: z.nativeEnum(ItemType).optional(),
  category_id: z.string().uuid().nullable().optional(),
  unit_of_measure: z.nativeEnum(UnitOfMeasure).optional(),
  cost_price: z.number().min(0).optional(),
  sell_price: z.number().min(0).optional(),
  reorder_point: z.number().int().min(0).optional(),
  reorder_qty: z.number().int().min(0).optional(),
  preferred_vendor_id: z.string().uuid().nullable().optional(),
  lead_time_days: z.number().int().min(0).nullable().optional(),
  safety_stock_days: z.number().int().min(0).optional(),
});

const adjustStockSchema = z.object({
  location_id: z.string().uuid(),
  qty_change: z.number().refine((v) => v !== 0, 'Quantity change cannot be zero'),
  reason: z.nativeEnum(AdjustmentReason),
  notes: z.string().optional(),
});

const setBinSchema = z.object({
  location_id: z.string().uuid(),
  bin_aisle: z.string().max(10).nullable().optional(),
  bin_shelf: z.string().max(10).nullable().optional(),
  bin_position: z.string().max(10).nullable().optional(),
});

// --- Item CRUD ---

// GET /api/items
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const categoryId = req.query.category_id as string;
    const itemType = req.query.item_type as string;
    const locationId = req.query.location_id as string;
    const vendorId = req.query.vendor_id as string;
    const lowStock = req.query.low_stock === 'true';
    const hasStock = req.query.has_stock as string; // 'true' = only items with stock, 'false' = zero stock
    const sortBy = req.query.sort_by as string || 'name';
    const sortDir = (req.query.sort_dir as string || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let where = 'WHERE i.is_active = true';
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (i.name ILIKE $${paramIdx} OR i.sku ILIKE $${paramIdx} OR i.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (categoryId) {
      where += ` AND i.category_id = $${paramIdx}`;
      params.push(categoryId);
      paramIdx++;
    }
    if (itemType) {
      where += ` AND i.item_type = $${paramIdx}`;
      params.push(itemType);
      paramIdx++;
    }
    if (vendorId) {
      where += ` AND i.preferred_vendor_id = $${paramIdx}`;
      params.push(vendorId);
      paramIdx++;
    }

    if (locationId) {
      params.push(locationId);
      paramIdx++;
    }

    // Build HAVING clause
    const havingClauses: string[] = [];
    if (lowStock) havingClauses.push('COALESCE(SUM(allil.qty_on_hand), 0) <= i.reorder_point');
    if (hasStock === 'true') havingClauses.push('COALESCE(SUM(allil.qty_on_hand), 0) > 0');
    if (hasStock === 'false') havingClauses.push('COALESCE(SUM(allil.qty_on_hand), 0) = 0');
    const havingClause = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

    // Sort mapping
    const sortColumns: Record<string, string> = {
      name: 'i.name',
      sku: 'i.sku',
      category: 'c.name',
      type: 'i.item_type',
      cost: 'i.cost_price',
      price: 'i.sell_price',
      on_hand: 'total_on_hand',
      available: 'total_available',
      reorder_point: 'i.reorder_point',
      created: 'i.created_at',
      updated: 'i.updated_at',
    };
    const orderCol = sortColumns[sortBy] || 'i.name';
    // For aggregated columns, use alias in ORDER BY
    const orderExpr = ['total_on_hand', 'total_available'].includes(orderCol) ? orderCol : orderCol;

    // When a location is selected, scope the qty SUMs to that location only
    // (and INNER JOIN on item_locations so we hide items that aren't tracked
    // at that location at all). When no location is selected, SUM across
    // every location to give the all-locations totals.
    const stockJoin = locationId
      ? `JOIN item_locations allil ON allil.item_id = i.id AND allil.location_id = $${paramIdx - 1}`
      : `LEFT JOIN item_locations allil ON allil.item_id = i.id`;

    // Count query (wrapping full query to account for HAVING)
    const innerQuery = `
      SELECT i.id
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      ${stockJoin}
      ${where}
      GROUP BY i.id, c.name
      ${havingClause}
    `;
    const countQuery = `SELECT COUNT(*) FROM (${innerQuery}) sub`;

    const dataQuery = `
      SELECT i.*,
        c.name as category_name,
        v.name as vendor_name,
        COALESCE(SUM(allil.qty_on_hand), 0) as total_on_hand,
        COALESCE(SUM(allil.qty_available), 0) as total_available,
        COALESCE(SUM(allil.qty_reserved), 0) as total_reserved
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN vendors v ON i.preferred_vendor_id = v.id
      ${stockJoin}
      ${where}
      GROUP BY i.id, c.name, v.name
      ${havingClause}
      ORDER BY ${orderExpr} ${sortDir} NULLS LAST
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      query(countQuery, params.slice(0, paramIdx - 1)),
      query(dataQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getItemWithLocations(req.params.id as string);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/items
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.OFFICE),
  validate(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        sku, name, description, item_type, category_id,
        unit_of_measure, cost_price, sell_price, reorder_point, reorder_qty,
        preferred_vendor_id, lead_time_days,
      } = req.body;

      if (sku) {
        const existing = await query('SELECT id FROM items WHERE sku = $1', [sku]);
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'SKU already exists' });
        }
      }

      const result = await query(
        `INSERT INTO items (sku, name, description, item_type, category_id, unit_of_measure, cost_price, sell_price, reorder_point, reorder_qty, preferred_vendor_id, lead_time_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [sku || null, name, description || null, item_type, category_id || null,
         unit_of_measure, cost_price, sell_price, reorder_point, reorder_qty,
         preferred_vendor_id || null,
         lead_time_days === undefined ? null : lead_time_days]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/items/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.OFFICE),
  validate(updateItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const result = await query(
        `UPDATE items SET ${fields.join(', ')} WHERE id = $${idx} AND is_active = true RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/items/:id (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        'UPDATE items SET is_active = false WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json({ message: 'Item deactivated' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/items/:id/adjust
router.post(
  '/:id/adjust',
  requireAuth,
  validate(adjustStockSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { location_id, qty_change, reason, notes } = req.body;

      const itemId = req.params.id as string;
      // Verify item exists
      const item = await query('SELECT id FROM items WHERE id = $1 AND is_active = true', [itemId]);
      if (item.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      await adjustStock({
        itemId,
        locationId: location_id,
        qtyChange: qty_change,
        reason,
        notes,
        adjustedBy: req.user!.userId,
      });

      const updated = await getItemWithLocations(itemId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/items/:id/history
router.get('/:id/history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const result = await getAdjustmentHistory(req.params.id as string, limit, offset);

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/items/:id/bin
router.post(
  '/:id/bin',
  requireAuth,
  validate(setBinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location_id, bin_aisle, bin_shelf, bin_position } = req.body;

      const result = await query(
        `INSERT INTO item_locations (item_id, location_id, bin_aisle, bin_shelf, bin_position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (item_id, location_id)
         DO UPDATE SET bin_aisle = $3, bin_shelf = $4, bin_position = $5
         RETURNING *`,
        [req.params.id, location_id, bin_aisle || null, bin_shelf || null, bin_position || null]
      );

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// --- Locations ---

// GET /api/locations
router.get('/locations/list', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM locations WHERE is_active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/locations
router.post(
  '/locations/list',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug, location_type, address } = req.body;
      // Auto-generate slug from name if not provided
      const finalSlug = (slug || name || '')
        .toString().toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
      if (!name || !location_type || !finalSlug) {
        return res.status(400).json({ error: 'name and location_type are required' });
      }
      const result = await query(
        `INSERT INTO locations (name, slug, location_type, address) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, finalSlug, location_type, address || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ error: 'Location with that slug already exists' });
      next(err);
    }
  }
);

// PATCH /api/locations/list/:id
router.patch(
  '/locations/list/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, location_type, address, is_active } = req.body;
      const result = await query(
        `UPDATE locations SET
           name = COALESCE($1, name),
           location_type = COALESCE($2, location_type),
           address = COALESCE($3, address),
           is_active = COALESCE($4, is_active)
         WHERE id = $5 RETURNING *`,
        [name, location_type, address, is_active, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/locations/list/:id — soft delete (is_active = false)
router.delete(
  '/locations/list/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `UPDATE locations SET is_active = false WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// --- Categories ---

// GET /api/categories
router.get('/categories/list', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM categories ORDER BY sort_order, name'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories
router.post(
  '/categories/list',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, parent_id, sort_order } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const result = await query(
        `INSERT INTO categories (name, parent_id, sort_order) VALUES ($1, $2, $3) RETURNING *`,
        [name, parent_id || null, sort_order || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/categories/list/:id
router.patch(
  '/categories/list/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, parent_id, sort_order } = req.body;
      const result = await query(
        `UPDATE categories SET
           name = COALESCE($1, name),
           parent_id = $2,
           sort_order = COALESCE($3, sort_order)
         WHERE id = $4 RETURNING *`,
        [name, parent_id ?? null, sort_order, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/categories/list/:id — refuses if category is in use
router.delete(
  '/categories/list/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usage = await query(
        'SELECT COUNT(*) as cnt FROM items WHERE category_id = $1',
        [req.params.id]
      );
      const count = parseInt(usage.rows[0].cnt, 10);
      if (count > 0) {
        return res.status(409).json({
          error: `Cannot delete: ${count} item${count === 1 ? '' : 's'} still use this category. Reassign them first.`,
        });
      }
      const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
