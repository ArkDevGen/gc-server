import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { getNextNumber } from '../services/sequence.service';

const router = Router();

const createInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  build_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  customer_email: z.string().email().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid().optional(),
    description: z.string().min(1),
    qty: z.number().positive(),
    unit_price: z.number().min(0),
  })).min(1),
});

// GET /api/invoices
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const customerId = req.query.customer_id as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortDir = (req.query.sort_dir as string) === 'asc' ? 'ASC' : 'DESC';

    let sql = `SELECT inv.*, c.name as customer_name, u.display_name as created_by_name
               FROM invoices inv
               JOIN customers c ON inv.customer_id = c.id
               JOIN users u ON inv.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND inv.status = $${idx}`; params.push(status); idx++; }
    if (customerId) { sql += ` AND inv.customer_id = $${idx}`; params.push(customerId); idx++; }
    if (search) {
      sql += ` AND (inv.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSorts: Record<string, string> = {
      invoice_number: 'inv.invoice_number',
      customer: 'c.name',
      date: 'inv.invoice_date',
      total: 'inv.total',
      email_status: 'inv.email_status',
      status: 'inv.status',
      created_at: 'inv.created_at',
    };
    const sortCol = allowedSorts[sortBy] || 'inv.created_at';

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

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invResult = await query(
      `SELECT inv.*, c.name as customer_name, u.display_name as created_by_name
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id
       JOIN users u ON inv.created_by = u.id
       WHERE inv.id = $1`, [req.params.id]
    );
    if (invResult.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const linesResult = await query(
      `SELECT il.*, i.name as item_name, i.sku as item_sku
       FROM invoice_lines il
       LEFT JOIN items i ON il.item_id = i.id
       WHERE il.invoice_id = $1 ORDER BY il.line_number`, [req.params.id]
    );

    res.json({ ...invResult.rows[0], lines: linesResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createInvoiceSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { customer_id, build_id, due_date, customer_email, notes, lines } = req.body;
      const invNumber = await getNextNumber('invoices', 'invoice_number', 'INV');

      const subtotal = lines.reduce((sum: number, l: any) => sum + l.qty * l.unit_price, 0);

      const invResult = await client.query(
        `INSERT INTO invoices (invoice_number, customer_id, build_id, due_date, subtotal, total, customer_email, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8) RETURNING *`,
        [invNumber, customer_id, build_id || null, due_date || null,
         Math.round(subtotal * 100) / 100, customer_email || null, notes || null, req.user!.userId]
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO invoice_lines (invoice_id, line_number, item_id, description, qty, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [invResult.rows[0].id, i + 1, line.item_id || null, line.description, line.qty, line.unit_price]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(invResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PATCH /api/invoices/:id/status
router.patch('/:id/status', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const result = await query(
        'UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
