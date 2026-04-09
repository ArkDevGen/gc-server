import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

async function fixAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Generated hash:', hash);

  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING username, id',
    [hash, 'admin']
  );
  console.log('Updated rows:', result.rows);

  // Verify it works
  const user = await pool.query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
  const valid = await bcrypt.compare('admin123', user.rows[0].password_hash);
  console.log('Password verify:', valid);

  await pool.end();
}

fixAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
