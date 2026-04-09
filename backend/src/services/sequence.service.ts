import { query } from '../config/database';

export async function getNextNumber(
  table: string,
  column: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const result = await query(
    `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [pattern]
  );

  let nextNum = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0][column] as string;
    const parts = lastNumber.split('-');
    nextNum = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}
