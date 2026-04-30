import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { sendSupportEmail, isSupportConfigured } from '../services/support.service';
import { env } from '../config/env';

const router = Router();

const contactSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  email: z.string().email().optional(),
  page_url: z.string().max(500).optional(),
});

// GET /api/support/config — light status check the frontend can use
// to disable the support button when Resend isn't wired up yet.
router.get('/config', requireAuth, (_req, res) => {
  res.json({
    enabled: isSupportConfigured(),
    support_to: env.SUPPORT_TO_EMAIL,
    client_name: env.CLIENT_NAME,
  });
});

// POST /api/support/contact — send a support request via Resend
router.post('/contact', requireAuth, validate(contactSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!isSupportConfigured()) {
        return res.status(503).json({
          error: `Support email is not configured yet. Please email ${env.SUPPORT_TO_EMAIL} directly for now.`,
        });
      }

      // Pull the requesting user's profile for context
      const userRes = await query(
        'SELECT display_name, email, role FROM users WHERE id = $1',
        [req.user!.userId]
      );
      const user = userRes.rows[0];
      if (!user) return res.status(401).json({ error: 'User not found' });

      const { subject, message, email, page_url } = req.body;

      await sendSupportEmail({
        subject,
        message,
        user_name: user.display_name,
        user_email: email || user.email || null,
        user_role: user.role,
        page_url: page_url || null,
      });

      res.json({ ok: true });
    } catch (err: any) {
      console.error('Support email failed:', err);
      next(err);
    }
  }
);

export default router;
