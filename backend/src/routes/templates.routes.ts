import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid().optional(),
    description: z.string().min(1),
    qty: z.number().positive(),
    unit_cost: z.number().min(0).default(0),
    unit_price: z.number().min(0).default(0),
  })).min(1),
});

// GET /api/templates
router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT qt.*, u.display_name as created_by_name,
       (SELECT COUNT(*) FROM quote_template_lines WHERE template_id = qt.id) as line_count
       FROM quote_templates qt
       JOIN users u ON qt.created_by = u.id
       WHERE qt.is_active = true
       ORDER BY qt.name`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/templates/:id (with lines)
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tplResult = await query('SELECT * FROM quote_templates WHERE id = $1', [req.params.id]);
    if (tplResult.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const linesResult = await query(
      `SELECT qtl.*, i.name as item_name, i.sku as item_sku
       FROM quote_template_lines qtl
       LEFT JOIN items i ON qtl.item_id = i.id
       WHERE qtl.template_id = $1 ORDER BY qtl.line_number`, [req.params.id]
    );

    res.json({ ...tplResult.rows[0], lines: linesResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createTemplateSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { name, description, lines } = req.body;

      const tplResult = await client.query(
        'INSERT INTO quote_templates (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name, description || null, req.user!.userId]
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO quote_template_lines (template_id, line_number, item_id, description, qty, unit_cost, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tplResult.rows[0].id, i + 1, line.item_id || null, line.description, line.qty, line.unit_cost, line.unit_price]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(tplResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PUT /api/templates/:id
router.put('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createTemplateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { name, description, lines } = req.body;
      const id = req.params.id as string;

      await client.query(
        'UPDATE quote_templates SET name = $1, description = $2 WHERE id = $3',
        [name, description || null, id]
      );

      // Replace lines
      await client.query('DELETE FROM quote_template_lines WHERE template_id = $1', [id]);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO quote_template_lines (template_id, line_number, item_id, description, qty, unit_cost, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, i + 1, line.item_id || null, line.description, line.qty, line.unit_cost, line.unit_price]
        );
      }

      await client.query('COMMIT');
      const updated = await query('SELECT * FROM quote_templates WHERE id = $1', [id]);
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// DELETE /api/templates/:id (soft)
router.delete('/:id', requireAuth, requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await query('UPDATE quote_templates SET is_active = false WHERE id = $1', [req.params.id]);
      res.json({ message: 'Template deactivated' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/templates/:id/create-quote — create a quote from this template
router.post('/:id/create-quote', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tpl = await query('SELECT * FROM quote_templates WHERE id = $1 AND is_active = true', [req.params.id]);
      if (tpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

      const lines = await query(
        'SELECT * FROM quote_template_lines WHERE template_id = $1 ORDER BY line_number', [req.params.id]
      );

      // Return the template data formatted for the quote creation form
      res.json({
        template_name: tpl.rows[0].name,
        lines: lines.rows.map((l: any) => ({
          item_id: l.item_id,
          description: l.description,
          qty: parseFloat(l.qty),
          unit_cost: parseFloat(l.unit_cost),
          unit_price: parseFloat(l.unit_price),
          is_surplus: false,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
