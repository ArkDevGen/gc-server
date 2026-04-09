import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { UserRole, AdjustmentReason } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { getNextNumber } from '../services/sequence.service';
import { adjustStock } from '../services/inventory.service';

const router = Router();

const createPOSchema = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid(),
  expected_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid().optional(),
    description: z.string().min(1),
    qty_ordered: z.number().positive(),
    unit_cost: z.number().min(0),
  })).min(1),
});

const receivePOSchema = z.object({
  notes: z.string().optional(),
  lines: z.array(z.object({
    po_line_id: z.string().uuid(),
    item_id: z.string().uuid().optional(),
    qty_received: z.number().positive(),
    location_id: z.string().uuid(),
    bin_aisle: z.string().optional(),
    bin_shelf: z.string().optional(),
    bin_position: z.string().optional(),
  })).min(1),
});

// GET /api/purchase-orders
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const vendorId = req.query.vendor_id as string;
    let sql = `SELECT po.*, v.name as vendor_name, l.name as location_name, u.display_name as created_by_name
               FROM purchase_orders po
               JOIN vendors v ON po.vendor_id = v.id
               JOIN locations l ON po.location_id = l.id
               JOIN users u ON po.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND po.status = $${idx}`; params.push(status); idx++; }
    if (vendorId) { sql += ` AND po.vendor_id = $${idx}`; params.push(vendorId); idx++; }

    sql += ' ORDER BY po.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/purchase-orders/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const poResult = await query(
      `SELECT po.*, v.name as vendor_name, l.name as location_name, u.display_name as created_by_name
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN locations l ON po.location_id = l.id
       JOIN users u ON po.created_by = u.id
       WHERE po.id = $1`, [req.params.id]
    );
    if (poResult.rows.length === 0) return res.status(404).json({ error: 'PO not found' });

    const linesResult = await query(
      `SELECT pol.*, i.name as item_name, i.sku as item_sku
       FROM purchase_order_lines pol
       LEFT JOIN items i ON pol.item_id = i.id
       WHERE pol.po_id = $1 ORDER BY pol.line_number`, [req.params.id]
    );

    res.json({ ...poResult.rows[0], lines: linesResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/purchase-orders
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createPOSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { vendor_id, location_id, expected_date, notes, lines } = req.body;
      const poNumber = await getNextNumber('purchase_orders', 'po_number', 'PO');

      const subtotal = lines.reduce((sum: number, l: any) => sum + l.qty_ordered * l.unit_cost, 0);

      const poResult = await client.query(
        `INSERT INTO purchase_orders (po_number, vendor_id, location_id, expected_date, subtotal, total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING *`,
        [poNumber, vendor_id, location_id, expected_date || null, Math.round(subtotal * 100) / 100, notes || null, req.user!.userId]
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO purchase_order_lines (po_id, line_number, item_id, description, qty_ordered, unit_cost)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [poResult.rows[0].id, i + 1, line.item_id || null, line.description, line.qty_ordered, line.unit_cost]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(poResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/purchase-orders/:id/receive
router.post('/:id/receive', requireAuth, validate(receivePOSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const poId = req.params.id as string;
      const { notes, lines } = req.body;

      // Create receipt
      const receiptResult = await client.query(
        'INSERT INTO po_receipts (po_id, received_by, notes) VALUES ($1, $2, $3) RETURNING id',
        [poId, req.user!.userId, notes || null]
      );
      const receiptId = receiptResult.rows[0].id;

      for (const line of lines) {
        // Insert receipt line
        await client.query(
          `INSERT INTO po_receipt_lines (receipt_id, po_line_id, item_id, qty_received, location_id, bin_aisle, bin_shelf, bin_position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [receiptId, line.po_line_id, line.item_id || null, line.qty_received, line.location_id,
           line.bin_aisle || null, line.bin_shelf || null, line.bin_position || null]
        );

        // Update PO line qty_received
        await client.query(
          'UPDATE purchase_order_lines SET qty_received = qty_received + $1 WHERE id = $2',
          [line.qty_received, line.po_line_id]
        );

        // Update inventory if item exists
        if (line.item_id) {
          await adjustStock({
            itemId: line.item_id,
            locationId: line.location_id,
            qtyChange: line.qty_received,
            reason: AdjustmentReason.RECEIVED,
            referenceType: 'po',
            referenceId: poId,
            notes: `Received on PO`,
            adjustedBy: req.user!.userId,
          });
        }
      }

      // Update PO status
      const poLines = await client.query(
        'SELECT qty_ordered, qty_received FROM purchase_order_lines WHERE po_id = $1', [poId]
      );
      const allReceived = poLines.rows.every((l: any) => parseFloat(l.qty_received) >= parseFloat(l.qty_ordered));
      const anyReceived = poLines.rows.some((l: any) => parseFloat(l.qty_received) > 0);

      const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : 'pending';
      await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [newStatus, poId]);

      await client.query('COMMIT');
      res.json({ message: 'Inventory received', status: newStatus });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
