import { getClient, query } from '../config/database';
import { AdjustmentReason } from '../config/constants';

interface AdjustStockParams {
  itemId: string;
  locationId: string;
  qtyChange: number;
  reason: AdjustmentReason;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  adjustedBy: string;
}

export async function adjustStock(params: AdjustStockParams): Promise<void> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the row and get current qty
    const lockResult = await client.query(
      `SELECT qty_on_hand FROM item_locations
       WHERE item_id = $1 AND location_id = $2
       FOR UPDATE`,
      [params.itemId, params.locationId]
    );

    let qtyBefore: number;

    if (lockResult.rows.length === 0) {
      // Create item_location record if it doesn't exist
      await client.query(
        `INSERT INTO item_locations (item_id, location_id, qty_on_hand)
         VALUES ($1, $2, 0)`,
        [params.itemId, params.locationId]
      );
      qtyBefore = 0;
    } else {
      qtyBefore = parseFloat(lockResult.rows[0].qty_on_hand);
    }

    const qtyAfter = qtyBefore + params.qtyChange;

    // Update stock level
    await client.query(
      `UPDATE item_locations SET qty_on_hand = $1
       WHERE item_id = $2 AND location_id = $3`,
      [qtyAfter, params.itemId, params.locationId]
    );

    // Insert audit record
    await client.query(
      `INSERT INTO inventory_adjustments
       (item_id, location_id, qty_change, qty_before, qty_after, reason, reference_type, reference_id, notes, adjusted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.itemId,
        params.locationId,
        params.qtyChange,
        qtyBefore,
        qtyAfter,
        params.reason,
        params.referenceType || null,
        params.referenceId || null,
        params.notes || null,
        params.adjustedBy,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getItemWithLocations(itemId: string) {
  const itemResult = await query(
    `SELECT i.*, c.name as category_name, v.name as vendor_name, v.website as vendor_website
     FROM items i
     LEFT JOIN categories c ON i.category_id = c.id
     LEFT JOIN vendors v ON i.preferred_vendor_id = v.id
     WHERE i.id = $1`,
    [itemId]
  );

  if (itemResult.rows.length === 0) return null;

  const locResult = await query(
    `SELECT il.*, l.name as location_name, l.location_type
     FROM item_locations il
     JOIN locations l ON il.location_id = l.id
     WHERE il.item_id = $1
     ORDER BY l.name`,
    [itemId]
  );

  return {
    ...itemResult.rows[0],
    locations: locResult.rows,
    total_on_hand: locResult.rows.reduce(
      (sum: number, r: any) => sum + parseFloat(r.qty_on_hand),
      0
    ),
    total_available: locResult.rows.reduce(
      (sum: number, r: any) => sum + parseFloat(r.qty_available),
      0
    ),
  };
}

export async function getAdjustmentHistory(
  itemId: string,
  limit: number = 50,
  offset: number = 0
) {
  const result = await query(
    `SELECT ia.*, l.name as location_name, u.display_name as adjusted_by_name
     FROM inventory_adjustments ia
     JOIN locations l ON ia.location_id = l.id
     JOIN users u ON ia.adjusted_by = u.id
     WHERE ia.item_id = $1
     ORDER BY ia.created_at DESC
     LIMIT $2 OFFSET $3`,
    [itemId, limit, offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) FROM inventory_adjustments WHERE item_id = $1',
    [itemId]
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}
