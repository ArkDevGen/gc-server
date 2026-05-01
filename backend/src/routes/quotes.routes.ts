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
  discount_pct: z.number().min(0).max(100).nullable().optional(),
  discount_amount: z.number().min(0).nullable().optional(),
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
  discount_pct: z.number().min(0).max(100).nullable().optional(),
  discount_amount: z.number().min(0).nullable().optional(),
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
    const search = req.query.search as string;
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortDir = (req.query.sort_dir as string) === 'asc' ? 'ASC' : 'DESC';

    let sql = `SELECT q.*, c.name as customer_name, u.display_name as created_by_name
               FROM quotes q
               JOIN customers c ON q.customer_id = c.id
               JOIN users u ON q.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND q.status = $${idx}`; params.push(status); idx++; }
    if (customerId) { sql += ` AND q.customer_id = $${idx}`; params.push(customerId); idx++; }
    if (search) {
      sql += ` AND (q.quote_number ILIKE $${idx} OR c.name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSorts: Record<string, string> = {
      quote_number: 'q.quote_number',
      customer: 'c.name',
      date: 'q.quote_date',
      total: 'q.total',
      margin: 'q.margin_pct',
      status: 'q.status',
      created_at: 'q.created_at',
    };
    const sortCol = allowedSorts[sortBy] || 'q.created_at';

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

// Computes subtotal, discount, total, margin% from lines + discount inputs.
// Discount is applied to subtotal before tax: total = subtotal - discount.
// Margin is calculated on the *discounted* total against cost.
function computeQuoteTotals(
  lines: any[],
  discountPct: number | null | undefined,
  discountAmount: number | null | undefined,
) {
  const subtotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_price, 0);
  const costTotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_cost, 0);
  let discount = 0;
  if (discountPct != null && discountPct > 0) {
    discount = subtotal * (Number(discountPct) / 100);
  } else if (discountAmount != null && discountAmount > 0) {
    discount = Math.min(Number(discountAmount), subtotal);
  }
  const total = Math.max(0, subtotal - discount);
  const marginPct = total > 0 ? ((total - costTotal) / total) * 100 : 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    total: round2(total),
    marginPct: round2(marginPct),
  };
}

// POST /api/quotes
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createQuoteSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { customer_id, valid_until, notes, lines, discount_pct, discount_amount } = req.body;
      const quoteNumber = await getNextNumber('quotes', 'quote_number', 'QT');

      const { subtotal, total, marginPct } = computeQuoteTotals(lines, discount_pct, discount_amount);

      const quoteResult = await client.query(
        `INSERT INTO quotes (quote_number, customer_id, valid_until, subtotal, total, margin_pct, discount_pct, discount_amount, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [quoteNumber, customer_id, valid_until || null, subtotal, total, marginPct,
         discount_pct ?? null, discount_amount ?? null, notes || null, req.user!.userId]
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
      const { customer_id, valid_until, notes, status, lines, discount_pct, discount_amount } = req.body;

      // Update quote header (covers status changes too)
      const headerHasChanges =
        customer_id !== undefined || valid_until !== undefined || notes !== undefined ||
        status !== undefined || discount_pct !== undefined || discount_amount !== undefined;
      if (headerHasChanges) {
        await client.query(
          `UPDATE quotes SET
            customer_id = COALESCE($1, customer_id),
            valid_until = COALESCE($2, valid_until),
            notes = COALESCE($3, notes),
            status = COALESCE($4, status),
            discount_pct = $5,
            discount_amount = $6
           WHERE id = $7`,
          [customer_id, valid_until, notes, status,
           discount_pct === undefined ? null : discount_pct,
           discount_amount === undefined ? null : discount_amount,
           quoteId]
        );
      }

      // Replace lines if provided
      if (lines) {
        await client.query('DELETE FROM quote_lines WHERE quote_id = $1', [quoteId]);

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

      // Recompute totals if either lines or discount changed
      if (lines || discount_pct !== undefined || discount_amount !== undefined) {
        const currentLinesRes = await client.query(
          'SELECT qty, unit_cost, unit_price FROM quote_lines WHERE quote_id = $1', [quoteId]
        );
        const currentDiscountRes = await client.query(
          'SELECT discount_pct, discount_amount FROM quotes WHERE id = $1', [quoteId]
        );
        const dPct = currentDiscountRes.rows[0].discount_pct;
        const dAmount = currentDiscountRes.rows[0].discount_amount;
        const { subtotal, total, marginPct } = computeQuoteTotals(
          currentLinesRes.rows.map((r: any) => ({
            qty: parseFloat(r.qty), unit_cost: parseFloat(r.unit_cost), unit_price: parseFloat(r.unit_price),
          })),
          dPct === null ? null : parseFloat(dPct),
          dAmount === null ? null : parseFloat(dAmount),
        );
        await client.query(
          'UPDATE quotes SET subtotal = $1, total = $2, margin_pct = $3 WHERE id = $4',
          [subtotal, total, marginPct, quoteId]
        );
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

// DELETE /api/quotes/:id — hard delete (cascades to quote_lines)
// Refuses if the quote has been converted to a build or consumed surplus,
// because deleting it would orphan those references.
router.delete('/:id', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;

      const buildCheck = await query('SELECT build_number FROM builds WHERE quote_id = $1', [id]);
      if (buildCheck.rows.length > 0) {
        const ref = buildCheck.rows[0].build_number;
        return res.status(409).json({
          error: `Cannot delete: this quote was converted to build ${ref}. Delete that build first, or change the quote's status to Rejected instead of deleting it.`,
        });
      }

      const surplusCheck = await query(
        'SELECT COUNT(*) as cnt FROM surplus_pool WHERE consumed_by_quote = $1',
        [id]
      );
      if (parseInt(surplusCheck.rows[0].cnt, 10) > 0) {
        return res.status(409).json({
          error: 'Cannot delete: this quote consumed surplus inventory. Change its status to Rejected instead of deleting it.',
        });
      }

      const result = await query('DELETE FROM quotes WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Quote not found' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
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

// GET /api/quotes/history/:customerId — quote history for a customer
router.get('/history/:customerId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT q.id, q.quote_number, q.status, q.quote_date, q.total, q.margin_pct,
       u.display_name as created_by_name,
       (SELECT COUNT(*) FROM quote_lines WHERE quote_id = q.id) as line_count
       FROM quotes q
       JOIN users u ON q.created_by = u.id
       WHERE q.customer_id = $1
       ORDER BY q.created_at DESC
       LIMIT 50`,
      [req.params.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
