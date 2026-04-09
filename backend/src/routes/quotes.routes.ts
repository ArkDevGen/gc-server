import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { getNextNumber } from '../services/sequence.service';

const router = Router();

const createQuoteSchema = z.object({
  customer_id: z.string().uuid(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid().optional(),
    description: z.string().min(1),
    qty: z.number().positive(),
    unit_cost: z.number().min(0).default(0),
    unit_price: z.number().min(0),
    is_surplus: z.boolean().default(false),
    surplus_location_id: z.string().uuid().optional(),
  })).min(1),
});

const updateQuoteSchema = z.object({
  customer_id: z.string().uuid().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid().optional(),
    description: z.string().min(1),
    qty: z.number().positive(),
    unit_cost: z.number().min(0).default(0),
    unit_price: z.number().min(0),
    is_surplus: z.boolean().default(false),
    surplus_location_id: z.string().uuid().optional(),
  })).optional(),
});

// GET /api/quotes
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const customerId = req.query.customer_id as string;
    let sql = `SELECT q.*, c.name as customer_name, u.display_name as created_by_name
               FROM quotes q
               JOIN customers c ON q.customer_id = c.id
               JOIN users u ON q.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND q.status = $${idx}`; params.push(status); idx++; }
    if (customerId) { sql += ` AND q.customer_id = $${idx}`; params.push(customerId); idx++; }

    sql += ' ORDER BY q.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/quotes/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteResult = await query(
      `SELECT q.*, c.name as customer_name, u.display_name as created_by_name
       FROM quotes q
       JOIN customers c ON q.customer_id = c.id
       JOIN users u ON q.created_by = u.id
       WHERE q.id = $1`, [req.params.id]
    );
    if (quoteResult.rows.length === 0) return res.status(404).json({ error: 'Quote not found' });

    const linesResult = await query(
      `SELECT ql.*, i.name as item_name, i.sku as item_sku, l.name as surplus_location_name
       FROM quote_lines ql
       LEFT JOIN items i ON ql.item_id = i.id
       LEFT JOIN locations l ON ql.surplus_location_id = l.id
       WHERE ql.quote_id = $1 ORDER BY ql.line_number`, [req.params.id]
    );

    // Check surplus availability for each line item
    const linesWithSurplus = await Promise.all(linesResult.rows.map(async (line: any) => {
      if (!line.item_id) return { ...line, surplus_available: [] };
      const surplus = await query(
        `SELECT sp.*, l.name as location_name
         FROM surplus_pool sp
         JOIN locations l ON sp.location_id = l.id
         WHERE sp.item_id = $1 AND sp.is_active = true`,
        [line.item_id]
      );
      return { ...line, surplus_available: surplus.rows };
    }));

    res.json({ ...quoteResult.rows[0], lines: linesWithSurplus });
  } catch (err) {
    next(err);
  }
});

// POST /api/quotes
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createQuoteSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { customer_id, valid_until, notes, lines } = req.body;
      const quoteNumber = await getNextNumber('quotes', 'quote_number', 'QT');

      const subtotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_price, 0);
      const costTotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_cost, 0);
      const marginPct = subtotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : 0;

      const quoteResult = await client.query(
        `INSERT INTO quotes (quote_number, customer_id, valid_until, subtotal, total, margin_pct, notes, created_by)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING *`,
        [quoteNumber, customer_id, valid_until || null, Math.round(subtotal * 100) / 100,
         Math.round(marginPct * 100) / 100, notes || null, req.user!.userId]
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO quote_lines (quote_id, line_number, item_id, description, qty, unit_cost, unit_price, is_surplus, surplus_location_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [quoteResult.rows[0].id, i + 1, line.item_id || null, line.description, line.qty,
           line.unit_cost, line.unit_price, line.is_surplus, line.surplus_location_id || null]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(quoteResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PATCH /api/quotes/:id
router.patch('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(updateQuoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const quoteId = req.params.id as string;
      const { customer_id, valid_until, notes, status, lines } = req.body;

      // Update quote header
      if (customer_id || valid_until || notes !== undefined || status) {
        await client.query(
          `UPDATE quotes SET
            customer_id = COALESCE($1, customer_id),
            valid_until = COALESCE($2, valid_until),
            notes = COALESCE($3, notes),
            status = COALESCE($4, status)
           WHERE id = $5`,
          [customer_id, valid_until, notes, status, quoteId]
        );
      }

      // Replace lines if provided
      if (lines) {
        await client.query('DELETE FROM quote_lines WHERE quote_id = $1', [quoteId]);

        const subtotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_price, 0);
        const costTotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_cost, 0);
        const marginPct = subtotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : 0;

        await client.query(
          'UPDATE quotes SET subtotal = $1, total = $1, margin_pct = $2 WHERE id = $3',
          [Math.round(subtotal * 100) / 100, Math.round(marginPct * 100) / 100, quoteId]
        );

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await client.query(
            `INSERT INTO quote_lines (quote_id, line_number, item_id, description, qty, unit_cost, unit_price, is_surplus, surplus_location_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [quoteId, i + 1, line.item_id || null, line.description, line.qty,
             line.unit_cost, line.unit_price, line.is_surplus, line.surplus_location_id || null]
          );
        }
      }

      await client.query('COMMIT');

      const updated = await query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
      res.json(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/quotes/:id/convert-to-build
router.post('/:id/convert-to-build', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const quoteId = req.params.id as string;

      const quoteResult = await client.query(
        `SELECT q.*, c.name as customer_name FROM quotes q JOIN customers c ON q.customer_id = c.id WHERE q.id = $1`,
        [quoteId]
      );
      if (quoteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Quote not found' });
      }
      const quote = quoteResult.rows[0];

      if (quote.converted_to_build) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Quote already converted to a build' });
      }

      const { location_id, name } = req.body;
      const buildNumber = await getNextNumber('builds', 'build_number', 'BLD');

      const buildResult = await client.query(
        `INSERT INTO builds (build_number, name, customer_id, location_id, quote_id, budget_total, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [buildNumber, name || `${quote.customer_name} - ${quote.quote_number}`,
         quote.customer_id, location_id, quoteId, quote.total, req.user!.userId]
      );
      const buildId = buildResult.rows[0].id;

      // Copy quote lines to build materials
      const quoteLines = await client.query(
        'SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number', [quoteId]
      );

      for (const line of quoteLines.rows) {
        if (line.item_id) {
          const sourceLocation = line.is_surplus && line.surplus_location_id
            ? line.surplus_location_id : location_id;

          await client.query(
            `INSERT INTO build_materials (build_id, item_id, source_location_id, qty_planned, unit_cost)
             VALUES ($1, $2, $3, $4, $5)`,
            [buildId, line.item_id, sourceLocation, parseFloat(line.qty), parseFloat(line.unit_cost)]
          );
        }
      }

      // Update quote
      await client.query(
        "UPDATE quotes SET converted_to_build = $1, status = 'converted' WHERE id = $2",
        [buildId, quoteId]
      );

      await client.query('COMMIT');
      res.status(201).json(buildResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
