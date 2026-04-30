import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/customers
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const includeInactive = req.query.include_inactive === 'true';
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (!includeInactive) {
      sql += ' AND is_active = true';
    }
    if (search) {
      sql += ` AND (name ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    sql += ' ORDER BY name';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(customerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, address } = req.body;
      const result = await query(
        'INSERT INTO customers (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, email || null, phone || null, address || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/customers/:id
router.patch('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, address, is_active } = req.body;
      const result = await query(
        `UPDATE customers SET
           name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           is_active = COALESCE($5, is_active)
         WHERE id = $6 RETURNING *`,
        [name, email, phone, address, is_active, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
