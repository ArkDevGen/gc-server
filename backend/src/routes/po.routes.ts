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
    const locationId = req.query.location_id as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortDir = (req.query.sort_dir as string) === 'asc' ? 'ASC' : 'DESC';

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
    if (locationId) { sql += ` AND po.location_id = $${idx}`; params.push(locationId); idx++; }
    if (search) {
      sql += ` AND (po.po_number ILIKE $${idx} OR v.name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const allowedSorts: Record<string, string> = {
      po_number: 'po.po_number',
      vendor: 'v.name',
      location: 'l.name',
      date: 'po.order_date',
      total: 'po.total',
      status: 'po.status',
      created_at: 'po.created_at',
    };
    const sortCol = allowedSorts[sortBy] || 'po.created_at';

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

// GET /api/purchase-orders/auto-generate/preview — preview POs that would be auto-generated
router.get('/auto-generate/preview', requireAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Find items below reorder point with a preferred vendor and reorder qty
      const result = await query(`
        SELECT i.id, i.sku, i.name, i.unit_of_measure, i.reorder_point, i.reorder_qty,
          i.cost_price, i.preferred_vendor_id,
          v.name as vendor_name,
          COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand,
          (i.reorder_qty - COALESCE(SUM(il.qty_on_hand), 0)) as qty_to_order
        FROM items i
        LEFT JOIN item_locations il ON il.item_id = i.id
        LEFT JOIN vendors v ON i.preferred_vendor_id = v.id
        WHERE i.is_active = true
          AND i.reorder_point > 0
          AND i.reorder_qty > 0
          AND i.preferred_vendor_id IS NOT NULL
        GROUP BY i.id, v.name
        HAVING COALESCE(SUM(il.qty_on_hand), 0) <= i.reorder_point
        ORDER BY v.name, i.name
      `);

      // Group by vendor
      const byVendor: Record<string, { vendor_id: string; vendor_name: string; items: any[]; total: number }> = {};
      for (const row of result.rows) {
        const vid = row.preferred_vendor_id;
        if (!byVendor[vid]) {
          byVendor[vid] = { vendor_id: vid, vendor_name: row.vendor_name, items: [], total: 0 };
        }
        const qtyToOrder = Math.max(parseFloat(row.qty_to_order), parseFloat(row.reorder_qty));
        const lineTotal = qtyToOrder * parseFloat(row.cost_price);
        byVendor[vid].items.push({ ...row, qty_to_order: qtyToOrder, line_total: Math.round(lineTotal * 100) / 100 });
        byVendor[vid].total += lineTotal;
      }

      const vendors = Object.values(byVendor).map((v) => ({ ...v, total: Math.round(v.total * 100) / 100 }));

      res.json({ vendors, total_items: result.rows.length, total_vendors: vendors.length });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchase-orders/auto-generate — create POs for all low-stock items
router.post('/auto-generate', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { location_id } = req.body; // where to deliver

      if (!location_id) {
        return res.status(400).json({ error: 'location_id is required (delivery location)' });
      }

      // Same query as preview
      const result = await client.query(`
        SELECT i.id, i.name, i.reorder_qty, i.cost_price, i.preferred_vendor_id,
          COALESCE(SUM(il.qty_on_hand), 0) as total_on_hand
        FROM items i
        LEFT JOIN item_locations il ON il.item_id = i.id
        WHERE i.is_active = true
          AND i.reorder_point > 0
          AND i.reorder_qty > 0
          AND i.preferred_vendor_id IS NOT NULL
        GROUP BY i.id
        HAVING COALESCE(SUM(il.qty_on_hand), 0) <= i.reorder_point
        ORDER BY i.preferred_vendor_id, i.name
      `);

      // Group by vendor
      const byVendor: Record<string, any[]> = {};
      for (const row of result.rows) {
        if (!byVendor[row.preferred_vendor_id]) byVendor[row.preferred_vendor_id] = [];
        byVendor[row.preferred_vendor_id].push(row);
      }

      const createdPOs: string[] = [];

      for (const [vendorId, items] of Object.entries(byVendor)) {
        const poNumber = await getNextNumber('purchase_orders', 'po_number', 'PO');
        const subtotal = items.reduce((sum: number, item: any) => {
          const qty = Math.max(parseFloat(item.reorder_qty), parseFloat(item.reorder_qty) - parseFloat(item.total_on_hand));
          return sum + qty * parseFloat(item.cost_price);
        }, 0);

        const poResult = await client.query(
          `INSERT INTO purchase_orders (po_number, vendor_id, location_id, subtotal, total, notes, created_by)
           VALUES ($1, $2, $3, $4, $4, $5, $6) RETURNING id, po_number`,
          [poNumber, vendorId, location_id, Math.round(subtotal * 100) / 100,
           'Auto-generated from low stock', req.user!.userId]
        );

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const qtyToOrder = Math.max(parseFloat(item.reorder_qty), parseFloat(item.reorder_qty));
          await client.query(
            `INSERT INTO purchase_order_lines (po_id, line_number, item_id, description, qty_ordered, unit_cost)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [poResult.rows[0].id, i + 1, item.id, item.name, qtyToOrder, parseFloat(item.cost_price)]
          );
        }

        createdPOs.push(poResult.rows[0].po_number);
      }

      await client.query('COMMIT');
      res.status(201).json({
        message: `Created ${createdPOs.length} purchase orders`,
        po_numbers: createdPOs,
        total_items: result.rows.length,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
