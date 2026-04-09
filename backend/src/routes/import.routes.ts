import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { query, getClient } from '../config/database';
import { UserRole } from '../config/constants';
import { requireAuth, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV values
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());

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
router.post('/vendors', requireAuth, requireRole(UserRole.ADMIN), upload.single('file'),
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
          const name = row.name || row.vendor_name || row.company || row.supplier;
          if (!name) { skipped++; continue; }

          const existing = await client.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)', [name]);
          if (existing.rows.length > 0) { skipped++; continue; }

          await client.query(
            'INSERT INTO vendors (name, email, phone, address) VALUES ($1, $2, $3, $4)',
            [name, row.email || null, row.phone || null, row.address || null]
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
        ['vendors', file.originalname, rows.length, imported, skipped, errored, JSON.stringify(errors), req.user!.userId]
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
