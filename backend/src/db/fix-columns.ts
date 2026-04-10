import { pool } from '../config/database';

async function fixColumns() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE items ALTER COLUMN sku TYPE VARCHAR(150)');
    console.log('SKU column expanded to 150');
    await client.query('ALTER TABLE items ALTER COLUMN name TYPE VARCHAR(500)');
    console.log('Name column expanded to 500');
    await client.query('ALTER TABLE quote_lines ALTER COLUMN description TYPE VARCHAR(1000)');
    console.log('Quote line description expanded to 1000');
  } finally {
    client.release();
    await pool.end();
  }
}

fixColumns().catch(console.error);
