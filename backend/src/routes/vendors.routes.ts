import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const vendorSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
});

// GET /api/vendors
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    let sql = 'SELECT * FROM vendors WHERE is_active = true';
    const params: any[] = [];

    if (search) {
      sql += ' AND (name ILIKE $1 OR email ILIKE $1)';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/vendors
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(vendorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, address } = req.body;
      const result = await query(
        'INSERT INTO vendors (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, email || null, phone || null, address || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/vendors/:id
router.patch('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, address } = req.body;
      const result = await query(
        `UPDATE vendors SET name = COALESCE($1, name), email = COALESCE($2, email),
         phone = COALESCE($3, phone), address = COALESCE($4, address)
         WHERE id = $5 RETURNING *`,
        [name, email, phone, address, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
