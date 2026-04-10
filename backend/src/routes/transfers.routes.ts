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

const createTransferSchema = z.object({
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid(),
    qty_requested: z.number().positive(),
    from_bin_label: z.string().optional(),
    to_bin_aisle: z.string().optional(),
    to_bin_shelf: z.string().optional(),
    to_bin_position: z.string().optional(),
  })).min(1),
});

// GET /api/transfers
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    let sql = `SELECT t.*, fl.name as from_location_name, tl.name as to_location_name,
               u.display_name as requested_by_name
               FROM transfers t
               JOIN locations fl ON t.from_location_id = fl.id
               JOIN locations tl ON t.to_location_id = tl.id
               JOIN users u ON t.requested_by = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND t.status = $${idx}`; params.push(status); idx++; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total);

    sql += ` ORDER BY t.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
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

// GET /api/transfers/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tResult = await query(
      `SELECT t.*, fl.name as from_location_name, tl.name as to_location_name,
       u.display_name as requested_by_name, a.display_name as approved_by_name,
       r.display_name as received_by_name
       FROM transfers t
       JOIN locations fl ON t.from_location_id = fl.id
       JOIN locations tl ON t.to_location_id = tl.id
       JOIN users u ON t.requested_by = u.id
       LEFT JOIN users a ON t.approved_by = a.id
       LEFT JOIN users r ON t.received_by = r.id
       WHERE t.id = $1`, [req.params.id]
    );
    if (tResult.rows.length === 0) return res.status(404).json({ error: 'Transfer not found' });

    const linesResult = await query(
      `SELECT tl.*, i.name as item_name, i.sku, i.unit_of_measure
       FROM transfer_lines tl
       JOIN items i ON tl.item_id = i.id
       WHERE tl.transfer_id = $1 ORDER BY i.name`, [req.params.id]
    );

    res.json({ ...tResult.rows[0], lines: linesResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/transfers
router.post('/', requireAuth, validate(createTransferSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { from_location_id, to_location_id, notes, lines } = req.body;

      if (from_location_id === to_location_id) {
        return res.status(400).json({ error: 'Source and destination must be different' });
      }

      const transferNumber = await getNextNumber('transfers', 'transfer_number', 'TRF');

      const tResult = await client.query(
        `INSERT INTO transfers (transfer_number, from_location_id, to_location_id, requested_by, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [transferNumber, from_location_id, to_location_id, req.user!.userId, notes || null]
      );

      for (const line of lines) {
        await client.query(
          `INSERT INTO transfer_lines (transfer_id, item_id, qty_requested, from_bin_label, to_bin_aisle, to_bin_shelf, to_bin_position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tResult.rows[0].id, line.item_id, line.qty_requested,
           line.from_bin_label || null, line.to_bin_aisle || null, line.to_bin_shelf || null, line.to_bin_position || null]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(tResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/transfers/:id/approve
router.post('/:id/approve', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `UPDATE transfers SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2 AND status = 'requested' RETURNING *`,
        [req.user!.userId, req.params.id]
      );
      if (result.rows.length === 0) return res.status(400).json({ error: 'Transfer not in requested status' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transfers/:id/ship — deduct from source location
router.post('/:id/ship', requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const transferId = req.params.id as string;

      const transfer = await client.query(
        "SELECT * FROM transfers WHERE id = $1 AND status IN ('requested', 'approved')", [transferId]
      );
      if (transfer.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Transfer not ready for shipping' });
      }

      const lines = await client.query(
        'SELECT * FROM transfer_lines WHERE transfer_id = $1', [transferId]
      );

      for (const line of lines.rows) {
        const qtyToShip = parseFloat(line.qty_requested);

        await adjustStock({
          itemId: line.item_id,
          locationId: transfer.rows[0].from_location_id,
          qtyChange: -qtyToShip,
          reason: AdjustmentReason.TRANSFER_OUT,
          referenceType: 'transfer',
          referenceId: transferId,
          adjustedBy: req.user!.userId,
        });

        await client.query(
          'UPDATE transfer_lines SET qty_shipped = $1 WHERE id = $2',
          [qtyToShip, line.id]
        );
      }

      await client.query(
        "UPDATE transfers SET status = 'in_transit', shipped_at = NOW() WHERE id = $1",
        [transferId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Transfer shipped' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/transfers/:id/receive — add to destination location
router.post('/:id/receive', requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const transferId = req.params.id as string;

      const transfer = await client.query(
        "SELECT * FROM transfers WHERE id = $1 AND status = 'in_transit'", [transferId]
      );
      if (transfer.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Transfer not in transit' });
      }

      const lines = await client.query(
        'SELECT * FROM transfer_lines WHERE transfer_id = $1', [transferId]
      );

      for (const line of lines.rows) {
        const qtyToReceive = parseFloat(line.qty_shipped);

        await adjustStock({
          itemId: line.item_id,
          locationId: transfer.rows[0].to_location_id,
          qtyChange: qtyToReceive,
          reason: AdjustmentReason.TRANSFER_IN,
          referenceType: 'transfer',
          referenceId: transferId,
          adjustedBy: req.user!.userId,
        });

        await client.query(
          'UPDATE transfer_lines SET qty_received = $1 WHERE id = $2',
          [qtyToReceive, line.id]
        );
      }

      await client.query(
        "UPDATE transfers SET status = 'received', received_by = $1, received_at = NOW() WHERE id = $2",
        [req.user!.userId, transferId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Transfer received' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

export default router;
