import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { query, getClient } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Split a single CSV line into its values, respecting quoted fields.
// Strips the surrounding double-quotes and unescapes "" -> ".
function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Handle escaped "" inside a quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Use the same quote-aware splitter for the header line so that
  // exports like `"Enabled","Vendor","Contact"` produce clean keys.
  const headers = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  );
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// POST /api/import/items — import inventory items from CSV
router.post('/items', requireAuth, requireRole(UserRole.ADMIN), upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const text = file.buffer.toString('utf-8');
      const rows = parseCSV(text);
      if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or invalid' });

      await client.query('BEGIN');

      let imported = 0, skipped = 0, errored = 0;
      const errors: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = row.name || row.item_name || row.product_name || row.description;
          if (!name) { skipped++; continue; }

          const sku = row.sku || row.item_number || row.product_code || null;

          // Skip duplicates by SKU
          if (sku) {
            const existing = await client.query('SELECT id FROM items WHERE sku = $1', [sku]);
            if (existing.rows.length > 0) { skipped++; continue; }
          }

          const costPrice = parseFloat(row.cost_price || row.cost || row.unit_cost || '0') || 0;
          const sellPrice = parseFloat(row.sell_price || row.price || row.unit_price || row.retail_price || '0') || 0;
          const reorderPoint = parseInt(row.reorder_point || row.min_stock || '0') || 0;

          // Find category by name if provided
          let categoryId = null;
          const categoryName = row.category || row.category_name || row.department;
          if (categoryName) {
            const catResult = await client.query(
              'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [categoryName]
            );
            if (catResult.rows.length > 0) {
              categoryId = catResult.rows[0].id;
            } else {
              // Create category
              const newCat = await client.query(
                'INSERT INTO categories (name) VALUES ($1) RETURNING id', [categoryName]
              );
              categoryId = newCat.rows[0].id;
            }
          }

          await client.query(
            `INSERT INTO items (sku, name, description, category_id, cost_price, sell_price, reorder_point)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [sku, name, row.description !== name ? row.description || null : null,
             categoryId, costPrice, sellPrice, reorderPoint]
          );
          imported++;
        } catch (err: any) {
          errored++;
          errors.push({ row: i + 2, error: err.message, data: row });
        }
      }

      // Log import
      await client.query(
        `INSERT INTO import_log (import_type, filename, rows_total, rows_imported, rows_skipped, rows_errored, errors, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['items', file.originalname, rows.length, imported, skipped, errored, JSON.stringify(errors), req.user!.userId]
      );

      await client.query('COMMIT');
      res.json({ total: rows.length, imported, skipped, errored, errors: errors.slice(0, 20) });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/import/customers — import customers from CSV
router.post('/customers', requireAuth, requireRole(UserRole.ADMIN), upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const text = file.buffer.toString('utf-8');
      const rows = parseCSV(text);
      if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or invalid' });

      await client.query('BEGIN');
      let imported = 0, skipped = 0, errored = 0;
      const errors: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = row.name || row.customer_name || row.company || row.company_name;
          if (!name) { skipped++; continue; }

          const email = row.email || row.customer_email || null;
          const phone = row.phone || row.phone_number || row.telephone || null;
          const address = row.address || row.street_address || [row.address1, row.city, row.state, row.zip].filter(Boolean).join(', ') || null;

          // Skip duplicates by name
          const existing = await client.query('SELECT id FROM customers WHERE LOWER(name) = LOWER($1)', [name]);
          if (existing.rows.length > 0) { skipped++; continue; }

          await client.query(
            'INSERT INTO customers (name, email, phone, address) VALUES ($1, $2, $3, $4)',
            [name, email, phone, address]
          );
          imported++;
        } catch (err: any) {
          errored++;
          errors.push({ row: i + 2, error: err.message });
        }
      }

      await client.query(
        `INSERT INTO import_log (import_type, filename, rows_total, rows_imported, rows_skipped, rows_errored, errors, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['customers', file.originalname, rows.length, imported, skipped, errored, JSON.stringify(errors), req.user!.userId]
      );

      await client.query('COMMIT');
      res.json({ total: rows.length, imported, skipped, errored, errors: errors.slice(0, 20) });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/import/vendors — import vendors from CSV
//
// Strategy: parse every row, group rows by lowercased vendor name, and merge
// data within each group (first non-empty wins per field, "any Yes wins" for
// is_active). Then for each merged record:
//   - if a vendor with that name already exists, UPDATE only the fields that
//     are currently NULL in the DB (preserves any manual edits, fills gaps)
//   - otherwise INSERT a new vendor
//
// This handles the Goodman Classic export where many vendors appear twice
// (once disabled, once enabled) and lets re-imports of the same file fill in
// missing data from earlier partial imports.
router.post('/vendors', requireAuth, requireRole(UserRole.ADMIN), upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await getClient();
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const text = file.buffer.toString('utf-8');
      const rows = parseCSV(text);
      if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or invalid' });

      // Pull a single field from a row, trimming and treating empty/whitespace as null.
      const pick = (row: Record<string, string>, ...keys: string[]): string | null => {
        for (const k of keys) {
          const v = row[k];
          if (v && v.trim()) return v.trim();
        }
        return null;
      };

      const placeholderRegex = /^(blank\d*|none|n\/a|test\d*|cho|chore|big|lb|qc|northwest|valco|lub|sdi)$/i;

      type MergedVendor = {
        name: string;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
        mobile_phone: string | null;
        address: string | null;
        website: string | null;
        is_active: boolean;
        sourceRows: number[];
      };

      const merged = new Map<string, MergedVendor>();
      let skipped = 0;
      const skippedRows: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rawName = pick(row, 'name', 'vendor_name', 'vendor', 'company', 'supplier');
        if (!rawName) {
          skipped++;
          continue;
        }

        if (placeholderRegex.test(rawName)) {
          skipped++;
          skippedRows.push({ row: i + 2, name: rawName, reason: 'placeholder/stub' });
          continue;
        }

        const enabledRaw = (row.enabled || row.active || row.is_active || 'yes').toString().trim().toLowerCase();
        const rowActive = !(enabledRaw === 'no' || enabledRaw === 'false' || enabledRaw === '0');

        const key = rawName.toLowerCase();
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, {
            name: rawName,
            contact_name: pick(row, 'contact_name', 'contact'),
            email: pick(row, 'email'),
            phone: pick(row, 'phone', 'phone_number'),
            mobile_phone: pick(row, 'mobile_phone', 'mobile', 'cell'),
            address: pick(row, 'address'),
            website: pick(row, 'website', 'url'),
            is_active: rowActive,
            sourceRows: [i + 2],
          });
        } else {
          // Field-level merge: keep first non-empty
          existing.contact_name ||= pick(row, 'contact_name', 'contact');
          existing.email ||= pick(row, 'email');
          existing.phone ||= pick(row, 'phone', 'phone_number');
          existing.mobile_phone ||= pick(row, 'mobile_phone', 'mobile', 'cell');
          existing.address ||= pick(row, 'address');
          existing.website ||= pick(row, 'website', 'url');
          // Any Yes wins for is_active
          if (rowActive) existing.is_active = true;
          existing.sourceRows.push(i + 2);
          skipped++;
          skippedRows.push({ row: i + 2, name: rawName, reason: `merged into row ${existing.sourceRows[0]}` });
        }
      }

      await client.query('BEGIN');

      let imported = 0, updated = 0, errored = 0, deactivated = 0;
      const errors: any[] = [];

      for (const m of merged.values()) {
        try {
          const existingRes = await client.query(
            'SELECT id, contact_name, email, phone, mobile_phone, address, website, is_active FROM vendors WHERE LOWER(name) = LOWER($1)',
            [m.name]
          );

          if (existingRes.rows.length > 0) {
            // Backfill NULL fields from merged data; sync is_active so that
            // duplicate rows that flipped Enabled=Yes win on re-import.
            // Manual edits to populated fields are preserved (we only fill nulls).
            const v = existingRes.rows[0];
            const sets: string[] = [];
            const params: any[] = [];
            let p = 1;
            const maybeFill = (col: keyof MergedVendor) => {
              if (!v[col] && m[col]) {
                sets.push(`${col} = $${p++}`);
                params.push(m[col]);
              }
            };
            maybeFill('contact_name');
            maybeFill('email');
            maybeFill('phone');
            maybeFill('mobile_phone');
            maybeFill('address');
            maybeFill('website');

            // Sync is_active to merged value if it differs
            if (v.is_active !== m.is_active) {
              sets.push(`is_active = $${p++}`);
              params.push(m.is_active);
            }

            if (sets.length > 0) {
              params.push(v.id);
              await client.query(
                `UPDATE vendors SET ${sets.join(', ')} WHERE id = $${p}`,
                params
              );
              updated++;
            }
            // else: existing record has all fields already, nothing to do
          } else {
            await client.query(
              `INSERT INTO vendors (name, contact_name, email, phone, mobile_phone, address, website, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [m.name, m.contact_name, m.email, m.phone, m.mobile_phone, m.address, m.website, m.is_active]
            );
            imported++;
            if (!m.is_active) deactivated++;
          }
        } catch (err: any) {
          errored++;
          errors.push({ name: m.name, rows: m.sourceRows, error: err.message });
        }
      }

      await client.query(
        `INSERT INTO import_log (import_type, filename, rows_total, rows_imported, rows_skipped, rows_errored, errors, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['vendors', file.originalname, rows.length, imported, skipped, errored,
         JSON.stringify({ errors, skipped: skippedRows.slice(0, 80), updated }), req.user!.userId]
      );

      await client.query('COMMIT');
      res.json({
        total: rows.length,
        merged_into: merged.size,
        imported,
        updated,
        skipped,
        errored,
        deactivated,
        errors: errors.slice(0, 20),
        skipped_details: skippedRows.slice(0, 80),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// GET /api/import/history — import history
router.get('/history', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT il.*, u.display_name as imported_by_name
       FROM import_log il JOIN users u ON il.imported_by = u.id
       ORDER BY il.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
