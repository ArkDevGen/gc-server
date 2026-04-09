import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../config/database';
import { env } from '../config/env';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  display_name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole),
});

const updateUserSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  is_active: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6),
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const result = await query(
      'SELECT id, username, password_hash, display_name, role, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as any
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT id, username, display_name, email, role FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { old_password, new_password } = req.body;
      const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user!.userId]
      );

      const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hash = await bcrypt.hash(new_password, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.userId]);

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/users (admin only)
router.get(
  '/users',
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        'SELECT id, username, display_name, email, role, is_active, created_at FROM users ORDER BY display_name'
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/users (admin only)
router.post(
  '/users',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, display_name, email, role } = req.body;

      const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const hash = await bcrypt.hash(password, 10);
      const result = await query(
        `INSERT INTO users (username, password_hash, display_name, email, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, display_name, email, role, is_active, created_at`,
        [username, hash, display_name, email || null, role]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/auth/users/:id (admin only)
router.patch(
  '/users/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate(updateUserSchema),
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
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
         RETURNING id, username, display_name, email, role, is_active`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
