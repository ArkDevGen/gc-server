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

const createBuildSchema = z.object({
  name: z.string().min(1).max(255),
  customer_id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  start_date: z.string().optional(),
  target_end_date: z.string().optional(),
  foreman_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  materials: z.array(z.object({
    item_id: z.string().uuid(),
    source_location_id: z.string().uuid(),
    qty_planned: z.number().positive(),
    unit_cost: z.number().min(0),
  })).optional(),
});

const recordUsageSchema = z.object({
  lines: z.array(z.object({
    build_material_id: z.string().uuid(),
    qty_used: z.number().positive(),
  })).min(1),
});

// GET /api/builds
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const foremanId = req.query.foreman_id as string;
    let sql = `SELECT b.*, c.name as customer_name, l.name as location_name,
               u.display_name as created_by_name, f.display_name as foreman_name
               FROM builds b
               LEFT JOIN customers c ON b.customer_id = c.id
               JOIN locations l ON b.location_id = l.id
               JOIN users u ON b.created_by = u.id
               LEFT JOIN users f ON b.foreman_id = f.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { sql += ` AND b.status = $${idx}`; params.push(status); idx++; }
    if (foremanId) { sql += ` AND b.foreman_id = $${idx}`; params.push(foremanId); idx++; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total);

    sql += ` ORDER BY b.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
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

// GET /api/builds/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buildResult = await query(
      `SELECT b.*, c.name as customer_name, l.name as location_name,
       u.display_name as created_by_name, f.display_name as foreman_name
       FROM builds b
       LEFT JOIN customers c ON b.customer_id = c.id
       JOIN locations l ON b.location_id = l.id
       JOIN users u ON b.created_by = u.id
       LEFT JOIN users f ON b.foreman_id = f.id
       WHERE b.id = $1`, [req.params.id]
    );
    if (buildResult.rows.length === 0) return res.status(404).json({ error: 'Build not found' });

    const materialsResult = await query(
      `SELECT bm.*, i.name as item_name, i.sku as item_sku, i.unit_of_measure,
       l.name as source_location_name
       FROM build_materials bm
       JOIN items i ON bm.item_id = i.id
       JOIN locations l ON bm.source_location_id = l.id
       WHERE bm.build_id = $1 ORDER BY i.name`, [req.params.id]
    );

    // Calculate variance
    const build = buildResult.rows[0];
    const materials = materialsResult.rows;
    const actualTotal = materials.reduce(
      (sum: number, m: any) => sum + parseFloat(m.qty_used) * parseFloat(m.unit_cost), 0
    );
    const surplusTotal = materials.reduce(
      (sum: number, m: any) => sum + parseFloat(m.qty_surplus) * parseFloat(m.unit_cost), 0
    );

    res.json({
      ...build,
      materials,
      actual_total_calc: Math.round(actualTotal * 100) / 100,
      surplus_value: Math.round(surplusTotal * 100) / 100,
      variance: Math.round((parseFloat(build.budget_total) - actualTotal) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/builds
router.post('/', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE), validate(createBuildSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { name, customer_id, location_id, start_date, target_end_date, foreman_id, notes, materials } = req.body;
      const buildNumber = await getNextNumber('builds', 'build_number', 'BLD');

      const budgetTotal = materials
        ? materials.reduce((sum: number, m: any) => sum + m.qty_planned * m.unit_cost, 0)
        : 0;

      const buildResult = await client.query(
        `INSERT INTO builds (build_number, name, customer_id, location_id, start_date, target_end_date, foreman_id, budget_total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [buildNumber, name, customer_id || null, location_id, start_date || null,
         target_end_date || null, foreman_id || null, Math.round(budgetTotal * 100) / 100,
         notes || null, req.user!.userId]
      );

      if (materials) {
        for (const mat of materials) {
          await client.query(
            `INSERT INTO build_materials (build_id, item_id, source_location_id, qty_planned, unit_cost)
             VALUES ($1, $2, $3, $4, $5)`,
            [buildResult.rows[0].id, mat.item_id, mat.source_location_id, mat.qty_planned, mat.unit_cost]
          );
        }
      }

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

// PATCH /api/builds/:id
router.patch('/:id', requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, status, start_date, target_end_date, foreman_id, notes } = req.body;
      const result = await query(
        `UPDATE builds SET
          name = COALESCE($1, name), status = COALESCE($2, status),
          start_date = COALESCE($3, start_date), target_end_date = COALESCE($4, target_end_date),
          foreman_id = COALESCE($5, foreman_id), notes = COALESCE($6, notes)
         WHERE id = $7 RETURNING *`,
        [name, status, start_date, target_end_date, foreman_id, notes, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Build not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/builds/:id/allocate — reserve inventory for the build
router.post('/:id/allocate', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const buildId = req.params.id as string;

      // Get unallocated materials
      const materials = await client.query(
        "SELECT * FROM build_materials WHERE build_id = $1 AND status = 'planned'", [buildId]
      );

      for (const mat of materials.rows) {
        // Reserve inventory
        await client.query(
          `UPDATE item_locations SET qty_reserved = qty_reserved + $1
           WHERE item_id = $2 AND location_id = $3`,
          [parseFloat(mat.qty_planned), mat.item_id, mat.source_location_id]
        );

        // Update material status
        await client.query(
          "UPDATE build_materials SET qty_allocated = qty_planned, status = 'allocated' WHERE id = $1",
          [mat.id]
        );
      }

      // Update build status to active
      await client.query("UPDATE builds SET status = 'active' WHERE id = $1", [buildId]);

      await client.query('COMMIT');
      res.json({ message: 'Materials allocated', count: materials.rows.length });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/builds/:id/record-usage — record materials used on site
router.post('/:id/record-usage', requireAuth, validate(recordUsageSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const buildId = req.params.id as string;
      const { lines } = req.body;

      for (const line of lines) {
        const mat = await client.query('SELECT * FROM build_materials WHERE id = $1 AND build_id = $2',
          [line.build_material_id, buildId]);
        if (mat.rows.length === 0) continue;

        const material = mat.rows[0];
        const newUsed = parseFloat(material.qty_used) + line.qty_used;

        // Update material qty_used
        await client.query(
          "UPDATE build_materials SET qty_used = $1, status = 'used' WHERE id = $2",
          [newUsed, line.build_material_id]
        );

        // Deduct from inventory
        await adjustStock({
          itemId: material.item_id,
          locationId: material.source_location_id,
          qtyChange: -line.qty_used,
          reason: AdjustmentReason.BUILD_USAGE,
          referenceType: 'build',
          referenceId: buildId,
          notes: `Used on build`,
          adjustedBy: req.user!.userId,
        });

        // Release reservation
        await client.query(
          `UPDATE item_locations SET qty_reserved = GREATEST(0, qty_reserved - $1)
           WHERE item_id = $2 AND location_id = $3`,
          [line.qty_used, material.item_id, material.source_location_id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Usage recorded' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/builds/:id/close-out — finalize build, capture surplus
router.post('/:id/close-out', requireAuth, requireRole(UserRole.ADMIN, UserRole.OFFICE),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const buildId = req.params.id as string;
      const { surplus_location_id } = req.body; // where to store surplus

      const materials = await client.query(
        'SELECT * FROM build_materials WHERE build_id = $1', [buildId]
      );

      let actualTotal = 0;
      let surplusCount = 0;

      for (const mat of materials.rows) {
        const allocated = parseFloat(mat.qty_allocated);
        const used = parseFloat(mat.qty_used);
        const surplus = allocated - used;
        const unitCost = parseFloat(mat.unit_cost);

        actualTotal += used * unitCost;

        if (surplus > 0) {
          // Record surplus on material
          await client.query(
            "UPDATE build_materials SET qty_surplus = $1, status = 'returned_surplus' WHERE id = $2",
            [surplus, mat.id]
          );

          // Add to surplus pool
          const targetLocation = surplus_location_id || mat.source_location_id;
          await client.query(
            `INSERT INTO surplus_pool (item_id, location_id, build_id, qty_available, original_cost, captured_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [mat.item_id, targetLocation, buildId, surplus, unitCost, req.user!.userId]
          );

          // Adjust inventory — release remaining reservation
          await client.query(
            `UPDATE item_locations SET qty_reserved = GREATEST(0, qty_reserved - $1)
             WHERE item_id = $2 AND location_id = $3`,
            [surplus, mat.item_id, mat.source_location_id]
          );

          // If surplus goes to a different location, transfer it
          if (surplus_location_id && surplus_location_id !== mat.source_location_id) {
            await adjustStock({
              itemId: mat.item_id,
              locationId: mat.source_location_id,
              qtyChange: -surplus,
              reason: AdjustmentReason.SURPLUS_CAPTURE,
              referenceType: 'build',
              referenceId: buildId,
              adjustedBy: req.user!.userId,
            });
            await adjustStock({
              itemId: mat.item_id,
              locationId: surplus_location_id,
              qtyChange: surplus,
              reason: AdjustmentReason.SURPLUS_CAPTURE,
              referenceType: 'build',
              referenceId: buildId,
              adjustedBy: req.user!.userId,
            });
          }

          surplusCount++;
        } else {
          // Release any remaining reservation
          await client.query(
            `UPDATE item_locations SET qty_reserved = GREATEST(0, qty_reserved - $1)
             WHERE item_id = $2 AND location_id = $3`,
            [Math.max(0, allocated - used), mat.item_id, mat.source_location_id]
          );
        }
      }

      // Finalize build
      await client.query(
        `UPDATE builds SET status = 'complete', actual_end_date = CURRENT_DATE,
         actual_total = $1 WHERE id = $2`,
        [Math.round(actualTotal * 100) / 100, buildId]
      );

      await client.query('COMMIT');
      res.json({
        message: 'Build closed out',
        actual_total: Math.round(actualTotal * 100) / 100,
        surplus_items: surplusCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// GET /api/builds/:id/surplus — get surplus from this build
router.get('/:id/surplus', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT sp.*, i.name as item_name, i.sku, i.unit_of_measure, l.name as location_name
       FROM surplus_pool sp
       JOIN items i ON sp.item_id = i.id
       JOIN locations l ON sp.location_id = l.id
       WHERE sp.build_id = $1 ORDER BY i.name`, [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
