import mysql from 'mysql2/promise';

/**
 * MySQL connection pool singleton
 * Reads configuration from environment variables with sensible defaults.
 * Defaults are provided to make local testing straightforward, but you should
 * prefer setting the environment variables in a .env file or your shell.
 *
 * Supported env vars:
 * - DB_HOST (default: localhost)
 * - DB_PORT (default: 3306)
 * - DB_USER (default: root)
 * - DB_PASSWORD (default: empty)
 * - DB_NAME (default: aktiva)
 *
 * NOTE: You provided credentials in the chat; those are used as defaults below
 * so the app can run locally immediately. If you prefer not to hardcode them
 * here, set the DB_* environment variables instead.
 */

const DEFAULTS = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'M3g4Gr3n1nj41!',
  database: process.env.DB_NAME || 'tiempo_Aktiva',
};

let pool: mysql.Pool | null = null;

export function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: DEFAULTS.host,
    port: DEFAULTS.port,
    user: DEFAULTS.user,
    password: DEFAULTS.password,
    database: DEFAULTS.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

/**
 * Try to find the first existing table from a list of candidates.
 */
export async function findExistingTable(candidates: string[]) {
  const p = getPool();
  for (const t of candidates) {
    try {
      const [rows] = await p.query(`SELECT 1 FROM \`${t}\` LIMIT 1`);
      // If query succeeds we assume table exists
      return t;
    } catch (e) {
      // ignore and try next
    }
  }
  return null;
}

/**
 * Get list of columns for a table.
 */
export async function getTableColumns(table: string) {
  const p = getPool();
  const [rows] = await p.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`, [DEFAULTS.database, table]);
  return (rows as any[]).map(r => String(r.COLUMN_NAME));
}

/**
 * Find the first matching column name in the table from a list of candidates.
 */
export async function pickColumn(table: string, candidates: string[]) {
  const cols = await getTableColumns(table);
  for (const c of candidates) {
    if (cols.includes(c)) return c;
    // also try lower-cased / underscore variants
    const normalized = c.toLowerCase().replace(/\s+/g, '_');
    const found = cols.find(col => col.toLowerCase() === normalized || col.toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}
