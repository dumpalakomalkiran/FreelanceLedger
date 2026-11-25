import type { Queryable } from 'pg';
import type { EntryFilter, ProjectFilter } from '../routes/input.ts';
export type Table = 'clients' | 'projects' | 'time_entries';
export type Fields = Record<string, string | number | boolean | null>;
interface RecordRow { id: number; project_id?: number; client_id?: number; archived?: boolean; invoice_id?: number | null }
const columns: Record<Table, readonly string[]> = {
  clients: ['name','email','currency','payment_terms_days'],
  projects: ['name','client_id','default_hourly_rate_minor','archived'],
  time_entries: ['project_id','entry_date','minutes','description','billable','hourly_rate_override_minor']
};
export async function row(db: Queryable, table: Table, id: number, lock = false) {
  return (await db.query<RecordRow>('SELECT * FROM '+table+' WHERE id=$1'+(lock ? ' FOR UPDATE' : ''), [id])).rows[0];
}
export async function save(db: Queryable, table: Table, data: Fields, id?: number) {
  const keys = Object.keys(data);
  if (!keys.length || keys.some(k => !columns[table].includes(k))) throw new Error('Invalid write fields.');
  const values = keys.map(k => data[k]);
  const params = keys.map((_, i) => '$' + (i+1));
  const sql = id === undefined
    ? 'INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+params.join(',')+')'
    : 'UPDATE '+table+' SET '+keys.map((k,i) => k+'='+params[i]).join(',')+' WHERE id=$'+(keys.length+1)
      +(table === 'time_entries' ? ' AND invoice_id IS NULL' : '');
  if (id !== undefined) values.push(id);
  return (await db.query<RecordRow>(sql+' RETURNING *', values)).rows[0];
}
export const clients = async (db: Queryable) => (await db.query('SELECT * FROM clients ORDER BY name,id')).rows;
export const projects = async (db: Queryable, f: ProjectFilter) => (await db.query(
  'SELECT * FROM projects WHERE ($1::int IS NULL OR client_id=$1) AND ($2::boolean IS NULL OR archived=$2) ORDER BY name,id',
  [f.client_id, f.archived])).rows;
export const entries = async (db: Queryable, f: EntryFilter) => (await db.query(`SELECT t.* FROM time_entries t
  JOIN projects p ON p.id=t.project_id WHERE ($1::int IS NULL OR p.client_id=$1)
  AND ($2::int IS NULL OR p.id=$2) AND ($3::date IS NULL OR entry_date >= $3)
  AND ($4::date IS NULL OR entry_date <= $4) AND ($5::boolean IS NULL OR billable=$5)
  AND ($6::boolean IS NULL OR (invoice_id IS NOT NULL)=$6) ORDER BY entry_date DESC,t.id DESC`,
  [f.client_id,f.project_id,f.from,f.to,f.billable,f.invoiced])).rows;
export const hasEntries = async (db: Queryable, id: number) =>
  (await db.query('SELECT 1 FROM time_entries WHERE project_id=$1 LIMIT 1',[id])).rows.length > 0;
export const removeEntry = (db: Queryable, id: number) =>
  db.query('DELETE FROM time_entries WHERE id=$1 AND invoice_id IS NULL',[id]);
