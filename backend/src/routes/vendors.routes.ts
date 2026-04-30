import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const vendorSchema = z.object({
  name: z.string().min(1).max(255),
  contact_name: z.string().max(255).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  mobile_phone: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET /api/vendors
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const includeInactive = req.query.include_inactive === 'true';
    let sql = 'SELECT * FROM vendors WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (!includeInactive) {
      sql += ' AND is_active = true';
    }
    if (search) {
      sql += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR contact_name ILIKE $${idx})`;
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

// POST /api/vendors
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(vendorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, contact_name, email, phone, mobile_phone, address, website } = req.body;
      const result = await query(
        `INSERT INTO vendors (name, contact_name, email, phone, mobile_phone, address, website)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, contact_name || null, email || null, phone || null, mobile_phone || null, address || null, website || null]
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
      const { name, contact_name, email, phone, mobile_phone, address, website, is_active } = req.body;
      const result = await query(
        `UPDATE vendors SET
           name = COALESCE($1, name),
           contact_name = COALESCE($2, contact_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           mobile_phone = COALESCE($5, mobile_phone),
           address = COALESCE($6, address),
           website = COALESCE($7, website),
           is_active = COALESCE($8, is_active)
         WHERE id = $9 RETURNING *`,
        [name, contact_name, email, phone, mobile_phone, address, website, is_active, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
