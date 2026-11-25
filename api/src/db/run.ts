import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';

const directory = new URL('../../migrations/', import.meta.url);
const bootstrap = `CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);`;

function migrationSql(): string {
  const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
  const statements = [bootstrap];
  for (const name of files) {
    if (!/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name)) throw new Error('Invalid migration filename');
    const sql = readFileSync(new URL(name, directory), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    statements.push(`SELECT EXISTS (SELECT FROM schema_migrations WHERE filename = '${name}') AS applied
\\gset
\\if :applied
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM schema_migrations WHERE filename = '${name}' AND checksum_sha256 = '${hash}') THEN
    RAISE EXCEPTION 'Changed migration: ${name}';
  END IF;
END $$;
\\else
${sql}
INSERT INTO schema_migrations VALUES ('${name}', '${hash}');
\\endif`);
  }
  return statements.join('\n');
}

const [command, target] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(command) || (target && target !== '--test')) {
  throw new Error('Usage: run.ts migrate|seed [--test]');
}
const dev = process.env.LEDGER_DB || 'freelanceledger';
const test = process.env.LEDGER_TEST_DB || 'freelanceledger_test';
if (dev === test || ![dev, test].every(name =>
  /^[a-z][a-z0-9_]{0,62}$/.test(name) && !['postgres', 'template0', 'template1'].includes(name))) {
  throw new Error('Choose distinct application database names.');
}
const sql = command === 'migrate' ? migrationSql() : readFileSync(new URL('seed.sql', import.meta.url), 'utf8');
const result = spawnSync('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '--single-transaction',
  '-h', '/var/run/postgresql', '-U', userInfo().username, '-d', target ? test : dev, '-f', '-'], {
  input: 'SELECT pg_advisory_xact_lock(48392102);\n' + sql + '\n',
  stdio: ['pipe', 'inherit', 'inherit']
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
