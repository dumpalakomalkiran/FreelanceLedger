import pg, { type Pool, type Queryable } from 'pg';
import { userInfo } from 'node:os';
pg.types.setTypeParser(1082, value => value);

export function openPool(test = false, schema?: string): Pool {
  const dev = process.env.LEDGER_DB || 'freelanceledger';
  const tests = process.env.LEDGER_TEST_DB || 'freelanceledger_test';
  if (dev === tests || ![dev, tests].every(v => /^[a-z][a-z0-9_]{0,62}$/.test(v) && !['postgres','template0','template1'].includes(v))) {
    throw new Error('Choose distinct application database names.');
  }
  if (schema && (!test || !/^ledger_test_[0-9a-f]+$/.test(schema))) throw new Error('Invalid test schema.');
  const pool = new pg.Pool({database: test ? tests : dev, host: '/var/run/postgresql', user: userInfo().username,
    options: schema ? '-c search_path=' + schema : undefined});
  pool.on('error', () => console.error('Idle database connection closed.'));
  return pool;
}
export async function transaction<T>(pool: Pool, work: (db: Queryable) => Promise<T>) {
  const connection = await pool.connect();
  let broken = false;
  try {
    await connection.query('BEGIN');
    const value = await work(connection);
    await connection.query('COMMIT');
    return value;
  } catch (error) {
    try { await connection.query('ROLLBACK'); } catch { broken = true; }
    throw error;
  } finally { connection.release(broken); }
}
