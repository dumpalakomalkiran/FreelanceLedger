import type { Queryable } from 'pg';
import type { InvoiceFilter, InvoiceInput } from '../routes/input.ts';
import type { calculate } from '../domain/money.ts';
import type { Status } from '../domain/status.ts';

interface Header { id: number; status: Status }
export async function header(db: Queryable, id: number, lock = 'share' as 'share' | 'update') {
  return (await db.query<Header>('SELECT * FROM invoices WHERE id=$1 FOR '+(lock === 'share' ? 'SHARE' : 'UPDATE'),[id])).rows[0];
}
export const lines = async (db: Queryable, id: number) => (await db.query(
  'SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY unit_rate_minor,id',[id])).rows;
export const list = async (db: Queryable, f: InvoiceFilter) => (await db.query(
  `SELECT * FROM invoices WHERE ($1::int IS NULL OR client_id=$1) AND ($2::text IS NULL OR status=$2)
   ORDER BY issue_date DESC,id DESC`,[f.client_id,f.status])).rows;
export async function project(db: Queryable, id: number) {
  return (await db.query<{name: string; client_id: number; default_hourly_rate_minor: string}>(
    'SELECT name,client_id,default_hourly_rate_minor FROM projects WHERE id=$1 FOR UPDATE',[id])).rows[0];
}
export async function client(db: Queryable, id: number) {
  return (await db.query<{id: number; currency: string; payment_terms_days: number}>(
    'SELECT id,currency,payment_terms_days FROM clients WHERE id=$1 FOR SHARE',[id])).rows[0];
}
export async function eligible(db: Queryable, input: InvoiceInput, defaultRate: string) {
  return (await db.query<{id: number; minutes: number; rate: string}>(`SELECT id,minutes,
    coalesce(hourly_rate_override_minor,$4::bigint) AS rate FROM time_entries
    WHERE project_id=$1 AND entry_date BETWEEN $2 AND $3 AND billable AND invoice_id IS NULL
    ORDER BY id FOR UPDATE`,[input.project_id,input.from,input.to,defaultRate])).rows;
}
export async function nextNumber(db: Queryable, year: string) {
  const {rows} = await db.query<{last_number: string}>(`INSERT INTO invoice_counters VALUES ($1,1)
    ON CONFLICT (calendar_year) DO UPDATE SET last_number=invoice_counters.last_number+1
    RETURNING last_number`,[year]);
  return 'INV-'+year+'-'+rows[0].last_number.padStart(4,'0');
}
export async function insert(db: Queryable, number: string, owner: NonNullable<Awaited<ReturnType<typeof client>>>,
    issue: string, now: Date, bps: number, totals: ReturnType<typeof calculate>) {
  return (await db.query<Header>(`INSERT INTO invoices
    (number,client_id,currency,issue_date,due_date,created_at,tax_rate_bps,subtotal_minor,tax_minor,total_minor)
    VALUES ($1,$2,$3,$4::date,$4::date+$5::int,$6,$7,$8,$9,$10) RETURNING *`,
    [number,owner.id,owner.currency,issue,owner.payment_terms_days,now,bps,totals.subtotal_minor,totals.tax_minor,totals.total_minor])).rows[0];
}
export async function insertLines(db: Queryable, id: number, description: string, items: ReturnType<typeof calculate>['lines']) {
  return (await db.query(`INSERT INTO invoice_lines (invoice_id,description,quantity_minutes,unit_rate_minor,amount_minor)
    SELECT $1,$2,quantity_minutes,unit_rate_minor,amount_minor FROM jsonb_to_recordset($3::jsonb)
    AS l(quantity_minutes bigint,unit_rate_minor bigint,amount_minor bigint) ORDER BY unit_rate_minor RETURNING *`,
    [id,description,JSON.stringify(items)])).rows;
}
export const attach = (db: Queryable, ids: number[], invoice: number) => db.query(
  'UPDATE time_entries SET invoice_id=$1 WHERE id=ANY($2::int[]) AND invoice_id IS NULL',[invoice,ids]);
export const changeStatus = async (db: Queryable,id: number,from: Status,to: Status,paidOn: string | null) =>
  (await db.query<Header>('UPDATE invoices SET status=$3,paid_on=$4 WHERE id=$1 AND status=$2 RETURNING *',
    [id,from,to,paidOn])).rows[0];
export const removeDraft = (db: Queryable,id: number) => db.query("DELETE FROM invoices WHERE id=$1 AND status='draft'",[id]);
