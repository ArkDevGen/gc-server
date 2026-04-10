import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

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

// Column mapping based on the quotes export structure (same format, no header)
const COLS = {
  id: 0, identifier: 1, quote_id: 2, seller_id: 3, contact_name: 4,
  organization_id: 5, organization_name: 6, contact_id_2: 7, contact_id_3: 8,
  order_id: 9, location_id: 10, location_name: 11,
  external_id: 12, external_id_2: 13, external_id_3: 14,
  created_at: 15, updated_at: 16, sent_at: 17, due_date: 18,
  paid_at: 19, paid_at_2: 20, notes: 21, notes_2: 22, notes_3: 23,
  status: 24, currency: 25, base_currency: 26, exchange_rate: 27,
  tax_id: 28, tax_name_extra: 29, tax_name: 30, tax_rate: 31,
  paid_amount: 32, total_amount: 33, total_without_tax: 34,
  total_tax: 35, total_discount: 36, grand_discount: 37, total_cost: 38,
  line_id: 39, line_qty: 40, line_unit_price: 41,
  line_sku: 42, line_title: 43, line_short_desc: 44, line_long_desc: 45,
  line_type: 46, line_status: 47, line_tax_exempt: 48, line_fee_exempt: 49,
};

async function importInvoices() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx src/db/import-qm-invoices.ts <path-to-csv>');
    process.exit(1);
  }

  const text = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  console.log(`Parsed ${lines.length} rows`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get admin user
    const adminUser = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminUser.rows[0]?.id;
    if (!adminId) throw new Error('No admin user found');

    // Group rows by invoice identifier
    const invoiceGroups = new Map<string, string[][]>();
    for (const line of lines) {
      const values = parseCSVLine(line);
      const identifier = values[1]; // INV-XXXX
      if (!identifier || !identifier.startsWith('INV-')) continue;
      if (!invoiceGroups.has(identifier)) invoiceGroups.set(identifier, []);
      invoiceGroups.get(identifier)!.push(values);
    }

    console.log(`Found ${invoiceGroups.size} unique invoices`);

    // Status mapping
    const statusMap: Record<string, string> = {
      'fully-paid': 'paid',
      'paid': 'paid',
      'partially-paid': 'draft',
      'sent': 'emailed',
      'draft': 'draft',
      'overdue': 'overdue',
      'voided': 'voided',
      'void': 'voided',
    };

    let imported = 0;
    let skipped = 0;
    let newItems = 0;
    let newCustomers = 0;

    // Get next invoice number sequence
    const lastInv = await client.query(
      "SELECT invoice_number FROM invoices WHERE invoice_number LIKE 'QM-INV-%' ORDER BY invoice_number DESC LIMIT 1"
    );
    let invSeq = 1;
    if (lastInv.rows.length > 0) {
      const parts = lastInv.rows[0].invoice_number.split('-');
      invSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    for (const [invId, invRows] of invoiceGroups) {
      const first = invRows[0];

      // Check if already imported
      const existing = await client.query(
        "SELECT id FROM invoices WHERE notes LIKE $1",
        [`%QM:${first[1]}%`]
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      // Find or create customer
      const contactName = first[4]?.trim();
      if (!contactName) { skipped++; continue; }

      let customerResult = await client.query('SELECT id FROM customers WHERE name = $1', [contactName]);
      if (customerResult.rows.length === 0) {
        const orgName = first[6]?.trim() || null;
        customerResult = await client.query(
          'INSERT INTO customers (name, address) VALUES ($1, $2) RETURNING id',
          [contactName, orgName ? `Organization: ${orgName}` : null]
        );
        newCustomers++;
      }
      const customerId = customerResult.rows[0].id;

      const invNumber = `QM-INV-${String(invSeq++).padStart(4, '0')}`;
      const status = statusMap[first[24]] || 'draft';
      const total = parseFloat(first[33]) || 0;
      const totalWithoutTax = parseFloat(first[34]) || 0;
      const totalTax = parseFloat(first[35]) || 0;

      const invDate = first[15] ? first[15].split('T')[0] : new Date().toISOString().split('T')[0];
      const dueDate = first[18] ? first[18].split('T')[0] : null;

      const invResult = await client.query(
        `INSERT INTO invoices (invoice_number, customer_id, status, invoice_date, due_date,
         subtotal, tax, total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          invNumber, customerId, status, invDate, dueDate,
          Math.round(totalWithoutTax * 100) / 100,
          Math.round(totalTax * 100) / 100,
          Math.round(total * 100) / 100,
          `Imported from QuoteMachine | QM:${first[1]} | Location: ${first[11] || 'N/A'}`,
          adminId,
        ]
      );
      const newInvId = invResult.rows[0].id;

      // Insert line items
      for (let i = 0; i < invRows.length; i++) {
        const row = invRows[i];
        const lineSku = row[42]?.trim();
        const lineTitle = row[43]?.trim();
        if (!lineTitle && !lineSku) continue;

        const cleanSku = (lineSku && lineSku !== '0' && lineSku.toLowerCase() !== 'freight' && lineSku.toLowerCase() !== 'labor')
          ? lineSku : null;

        // Find or create item
        let itemId = null;
        if (cleanSku) {
          const itemResult = await client.query('SELECT id FROM items WHERE sku = $1', [cleanSku]);
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id;
        }
        if (!itemId && lineTitle) {
          const itemResult = await client.query('SELECT id FROM items WHERE name = $1', [lineTitle]);
          if (itemResult.rows.length > 0) itemId = itemResult.rows[0].id;
        }
        if (!itemId && lineTitle) {
          const isService = !cleanSku ||
            lineTitle.toLowerCase().includes('labor') ||
            lineTitle.toLowerCase().includes('freight') ||
            lineTitle.toLowerCase().includes('shipping');
          const priceStr = (row[41] || '').replace(/[$,]/g, '');
          const price = parseFloat(priceStr) || 0;
          const newItem = await client.query(
            'INSERT INTO items (sku, name, item_type, sell_price, cost_price) VALUES ($1, $2, $3, $4, 0) RETURNING id',
            [cleanSku, lineTitle, isService ? 'service' : 'inventory', price]
          );
          itemId = newItem.rows[0].id;
          newItems++;
        }

        const qty = parseFloat(row[40]) || 1;
        const priceStr = (row[41] || '').replace(/[$,]/g, '');
        const unitPrice = parseFloat(priceStr) || 0;

        await client.query(
          'INSERT INTO invoice_lines (invoice_id, line_number, item_id, description, qty, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
          [newInvId, i + 1, itemId, lineTitle || lineSku || 'Item', qty, unitPrice]
        );
      }

      imported++;
      if (imported % 100 === 0) console.log(`  ...${imported} invoices imported`);
    }

    await client.query('COMMIT');
    console.log(`\n=== Invoice Import Complete ===`);
    console.log(`Invoices: ${imported} imported, ${skipped} skipped`);
    console.log(`New customers: ${newCustomers}`);
    console.log(`New items: ${newItems}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importInvoices().catch((err) => {
  console.error(err);
  process.exit(1);
});
