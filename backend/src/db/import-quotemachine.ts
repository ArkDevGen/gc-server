import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

// Parse CSV handling quoted fields
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
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

async function importQuoteMachine() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx src/db/import-quotemachine.ts <path-to-csv>');
    process.exit(1);
  }

  const text = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ===== STEP 1: Import Customers =====
    console.log('\n--- Importing Customers ---');
    const customerMap = new Map<string, string>(); // contact_id -> our UUID
    const seen = new Map<string, boolean>();

    for (const row of rows) {
      const contactId = row.contact_id;
      if (!contactId || seen.has(contactId)) continue;
      seen.set(contactId, true);

      const name = row.contact_name?.trim();
      if (!name) continue;

      const orgName = row.organization_name?.trim() || null;

      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM customers WHERE name = $1', [name]
      );

      if (existing.rows.length > 0) {
        customerMap.set(contactId, existing.rows[0].id);
        continue;
      }

      const result = await client.query(
        `INSERT INTO customers (name, address)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [name, orgName ? `Organization: ${orgName}` : null]
      );

      if (result.rows.length > 0) {
        customerMap.set(contactId, result.rows[0].id);
      }
    }
    console.log(`Imported ${customerMap.size} customers`);

    // ===== STEP 2: Import Items (Products) =====
    console.log('\n--- Importing Items ---');
    const itemMap = new Map<string, string>(); // sku -> our UUID
    const skuSeen = new Map<string, boolean>();

    for (const row of rows) {
      const sku = row.line_product_sku?.trim();
      const title = row.line_product_title?.trim();
      if (!title || skuSeen.has(sku + '|' + title)) continue;
      skuSeen.set(sku + '|' + title, true);

      // Skip empty/generic SKUs
      const cleanSku = (sku && sku !== '0' && sku.toLowerCase() !== 'freight' && sku.toLowerCase() !== 'labor')
        ? sku : null;

      // Check if already exists by SKU or name
      let existing;
      if (cleanSku) {
        existing = await client.query('SELECT id FROM items WHERE sku = $1', [cleanSku]);
      }
      if (!existing || existing.rows.length === 0) {
        existing = await client.query('SELECT id FROM items WHERE name = $1', [title]);
      }

      if (existing.rows.length > 0) {
        const key = cleanSku || title;
        itemMap.set(key, existing.rows[0].id);
        continue;
      }

      // Determine item type
      const isService = !cleanSku ||
        title.toLowerCase().includes('labor') ||
        title.toLowerCase().includes('freight') ||
        title.toLowerCase().includes('shipping') ||
        title.toLowerCase().includes('install');

      // Extract price from the line_unit_price (remove $ and commas)
      const priceStr = (row.line_unit_price || '').replace(/[$,]/g, '');
      const price = parseFloat(priceStr) || 0;

      const result = await client.query(
        `INSERT INTO items (sku, name, description, item_type, sell_price, cost_price)
         VALUES ($1, $2, $3, $4, $5, 0)
         RETURNING id`,
        [
          cleanSku,
          title,
          row.line_product_short_description?.trim() || null,
          isService ? 'service' : 'inventory',
          price,
        ]
      );

      if (result.rows.length > 0) {
        const key = cleanSku || title;
        itemMap.set(key, result.rows[0].id);
      }
    }
    console.log(`Imported ${itemMap.size} items`);

    // ===== STEP 3: Import Quotes =====
    console.log('\n--- Importing Quotes ---');

    // Group rows by quote identifier
    const quoteGroups = new Map<string, typeof rows>();
    for (const row of rows) {
      const id = row.identifier;
      if (!id) continue;
      if (!quoteGroups.has(id)) quoteGroups.set(id, []);
      quoteGroups.get(id)!.push(row);
    }

    let quotesImported = 0;
    let quotesSkipped = 0;

    // Get next quote number
    const lastQuote = await client.query(
      "SELECT quote_number FROM quotes WHERE quote_number LIKE 'QM-%' ORDER BY quote_number DESC LIMIT 1"
    );
    let quoteSeq = 1;
    if (lastQuote.rows.length > 0) {
      const parts = lastQuote.rows[0].quote_number.split('-');
      quoteSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    // Get admin user for created_by
    const adminUser = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminUser.rows[0]?.id;
    if (!adminId) throw new Error('No admin user found');

    // Map QM status to our status
    const statusMap: Record<string, string> = {
      'draft': 'draft',
      'proposed': 'sent',
      'new': 'draft',
      'pre-approved': 'sent',
      'approved': 'accepted',
      'declined': 'rejected',
      'pre-declined': 'rejected',
      'ordered': 'converted',
      'invoiced': 'converted',
      'cancelled': 'expired',
    };

    for (const [quoteId, quoteRows] of quoteGroups) {
      const firstRow = quoteRows[0];

      // Check if already imported
      const existing = await client.query(
        "SELECT id FROM quotes WHERE notes LIKE $1",
        [`%QM:${firstRow.identifier}%`]
      );
      if (existing.rows.length > 0) {
        quotesSkipped++;
        continue;
      }

      const customerId = customerMap.get(firstRow.contact_id);
      if (!customerId) { quotesSkipped++; continue; }

      const quoteNumber = `QM-${String(quoteSeq++).padStart(4, '0')}`;
      const status = statusMap[firstRow.status] || 'draft';
      const total = parseFloat(firstRow.total_amount) || 0;
      const totalWithoutTax = parseFloat(firstRow.total_amount_without_tax) || 0;
      const totalCost = parseFloat(firstRow.total_cost) || 0;
      const marginPct = totalWithoutTax > 0
        ? ((totalWithoutTax - totalCost) / totalWithoutTax) * 100 : 0;

      const quoteDate = firstRow.created_at
        ? firstRow.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      const validUntil = firstRow.expiration_date
        ? firstRow.expiration_date.split('T')[0] : null;

      const quoteResult = await client.query(
        `INSERT INTO quotes (quote_number, customer_id, status, quote_date, valid_until,
         subtotal, total, margin_pct, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          quoteNumber, customerId, status, quoteDate, validUntil,
          Math.round(totalWithoutTax * 100) / 100,
          Math.round(total * 100) / 100,
          Math.round(marginPct * 100) / 100,
          `Imported from QuoteMachine | QM:${firstRow.identifier} | Location: ${firstRow.location_name || 'N/A'}`,
          adminId,
        ]
      );

      const newQuoteId = quoteResult.rows[0].id;

      // Insert line items
      for (let i = 0; i < quoteRows.length; i++) {
        const line = quoteRows[i];
        const lineSku = line.line_product_sku?.trim();
        const lineTitle = line.line_product_title?.trim();
        if (!lineTitle && !lineSku) continue;

        const cleanSku = (lineSku && lineSku !== '0' && lineSku.toLowerCase() !== 'freight' && lineSku.toLowerCase() !== 'labor')
          ? lineSku : null;
        const itemId = itemMap.get(cleanSku || lineTitle || '') || null;

        const qty = parseFloat(line.line_quantity) || 1;
        const priceStr = (line.line_unit_price || '').replace(/[$,]/g, '');
        const unitPrice = parseFloat(priceStr) || 0;

        await client.query(
          `INSERT INTO quote_lines (quote_id, line_number, item_id, description, qty, unit_cost, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newQuoteId, i + 1, itemId, lineTitle || lineSku || 'Item', qty, 0, unitPrice]
        );
      }

      quotesImported++;
    }

    console.log(`Imported ${quotesImported} quotes, skipped ${quotesSkipped}`);

    await client.query('COMMIT');
    console.log('\n=== Import Complete ===');
    console.log(`Customers: ${customerMap.size}`);
    console.log(`Items: ${itemMap.size}`);
    console.log(`Quotes: ${quotesImported}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importQuoteMachine().catch((err) => {
  console.error(err);
  process.exit(1);
});
