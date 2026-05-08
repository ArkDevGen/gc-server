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
import { logAudit, getIp } from '../services/audit.service';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const strongPassword = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: strongPassword,
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
  new_password: strongPassword,
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
      logAudit({ action: 'LOGIN_FAILURE', username, ipAddress: getIp(req), metadata: { reason: 'user not found' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      logAudit({ action: 'LOGIN_FAILURE', userId: user.id, username, ipAddress: getIp(req), metadata: { reason: 'account disabled' } });
      return res.status(401).json({ error: 'Account is disabled' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit({ action: 'LOGIN_FAILURE', userId: user.id, username, ipAddress: getIp(req), metadata: { reason: 'wrong password' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logAudit({ action: 'LOGIN_SUCCESS', userId: user.id, username: user.username, ipAddress: getIp(req) });

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

      logAudit({ action: 'PASSWORD_CHANGED', userId: req.user!.userId, username: req.user!.username, ipAddress: getIp(req) });
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

// GET /api/auth/users/list — lightweight list for dropdowns (any authenticated user)
// Optional ?role= query to filter by role
router.get(
  '/users/list',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as string;
      let sql = 'SELECT id, display_name, role FROM users WHERE is_active = true';
      const params: any[] = [];
      if (role) {
        sql += ' AND role = $1';
        params.push(role);
      }
      sql += ' ORDER BY display_name';
      const result = await query(sql, params);
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

      logAudit({ action: 'USER_CREATED', userId: req.user!.userId, username: req.user!.username, resourceType: 'user', resourceId: result.rows[0].id, ipAddress: getIp(req), metadata: { created_username: username, role } });
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

      const action = updates.is_active === false ? 'USER_DEACTIVATED' : 'USER_UPDATED';
      logAudit({ action, userId: req.user!.userId, username: req.user!.username, resourceType: 'user', resourceId: id, ipAddress: getIp(req), metadata: updates });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
