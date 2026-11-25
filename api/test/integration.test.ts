import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { exchange } from './http.ts';
import { openPool } from '../src/db/pool.ts';
import { app } from '../src/app.ts';

describe('ledger API with PostgreSQL', () => {
  const schema = 'ledger_test_' + randomBytes(8).toString('hex');
  const admin = openPool(true);
  const db = openPool(true,schema);
  const api = app(db,{now:() => new Date('2026-01-31T23:45:00Z')});
  let created = false;
  before(async () => {
    await admin.query('CREATE SCHEMA '+schema);
    created = true;
    const dir = new URL('../migrations/',import.meta.url);
    for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
      await db.query(await readFile(new URL(file,dir),'utf8'));
    }
  });
  after(async () => {
    await db.end();
    try { if (created) await admin.query('DROP SCHEMA '+schema+' CASCADE'); }
    finally { await admin.end(); }
  });

  function call(method: string, path: string, body?: object) {
    return exchange(api,method,'/api'+path,body ? JSON.stringify(body) : '');
  }
  async function send(method: string,path: string,status: number,body?: object) {
    const res = await call(method,path,body);
    assert.equal(res.status,status,JSON.stringify(res.body));
    return res.body;
  }
  async function fixtures() {
    const client = await send('POST','/clients',201,{name:'Cedar',email:'hello@example.com'});
    const project = await send('POST','/projects',201,{client_id:client.id,name:'Guide',default_hourly_rate_minor:'15'});
    return {client,project};
  }
  const add = (project_id: number,extra = {}) => send('POST','/time-entries',201,
    {project_id,entry_date:'2026-01-14',minutes:1,description:'Layout',...extra});
  const range = (project_id: number) => ({project_id,from:'2026-01-14',to:'2026-01-14',tax_rate_bps:5000});
  const make = '/invoices/from-unbilled-time';

  it('validates bodies, list filters, references and missing records',async () => {
    assert.equal((await send('POST','/clients',400,{})).error.code,'INVALID_INPUT');
    await send('GET','/projects?archived=maybe',400);
    await send('GET','/time-entries?from=2026-02-01&to=2026-01-01',400);
    await send('GET','/invoices?status=invalid',400);
    await send('POST','/projects',404,{client_id:2000000,name:'Guide',default_hourly_rate_minor:'0'});
    await send('GET','/clients/2000000',404);
  });
  it('edits clients, archives projects and edits and removes unattached entries',async () => {
    const {client,project} = await fixtures();
    assert.equal(client.payment_terms_days,14);
    assert.equal(client.currency,'INR');
    await send('PATCH','/clients/'+client.id,400,{currency:'USD'});
    await send('POST','/clients',400,{name:'Other',email:'other@example.com',currency:'USD'});
    await send('PATCH','/clients/'+client.id,200,{name:'Cedar Studio'});
    assert.equal((await send('GET','/clients/'+client.id,200)).name,'Cedar Studio');
    assert.ok((await send('GET','/clients',200)).some((c:{id:number}) => c.id===client.id));
    const entry = await add(project.id,{hourly_rate_override_minor:'11'});
    assert.equal((await send('PATCH','/time-entries/'+entry.id,200,{hourly_rate_override_minor:null})).hourly_rate_override_minor,null);
    const other = await fixtures();
    await send('PATCH','/projects/'+project.id,409,{client_id:other.client.id});
    await send('PATCH','/projects/'+project.id,200,{archived:true});
    assert.equal((await send('GET','/projects/'+project.id,200)).archived,true);
    assert.equal((await send('GET','/projects?archived=true&client_id='+client.id,200)).length,1);
    await send('POST','/time-entries',409,{project_id:project.id,entry_date:'2026-01-14',minutes:1,description:'Test'});
    await send('DELETE','/time-entries/'+entry.id,204);
    await send('GET','/time-entries/'+entry.id,404);
  });
  it('groups only eligible entries, releases drafts and preserves issued amounts',async () => {
    const {project,client} = await fixtures();
    const first = await add(project.id);
    await add(project.id);
    await add(project.id,{hourly_rate_override_minor:'0'});
    await add(project.id,{billable:false});
    await add(project.id,{entry_date:'2026-01-15'});
    const body = range(project.id);
    const draft = await send('POST',make,201,body);
    assert.deepEqual(draft.lines.map((l:{amount_minor:string}) => l.amount_minor),['0','1']);
    assert.deepEqual([draft.issue_date,draft.due_date,draft.total_minor,draft.tax_minor],
      ['2026-01-31','2026-02-14','2','1']);
    assert.equal(draft.created_at,'2026-01-31T23:45:00.000Z');
    assert.equal((await send('GET','/time-entries?project_id='+project.id+'&invoiced=true',200)).length,3);
    assert.equal((await send('POST',make,422,body)).error.code,'NOTHING_TO_BILL');
    await send('PATCH','/time-entries/'+first.id,409,{minutes:5});
    await send('DELETE','/time-entries/'+first.id,409);
    await send('DELETE','/invoices/'+draft.id,204);
    assert.equal((await send('GET','/time-entries/'+first.id,200)).invoice_id,null);
    const replacement = await send('POST',make,201,body);
    assert.notEqual(replacement.number,draft.number);
    const url = '/invoices/'+replacement.id;
    await send('PATCH',url+'/status',409,{status:'paid'});
    await send('PATCH',url+'/status',200,{status:'sent'});
    await send('PATCH',url+'/status',409,{status:'sent'});
    await send('DELETE',url,409);
    await send('PATCH','/projects/'+project.id,200,{default_hourly_rate_minor:'999'});
    await send('PATCH','/clients/'+client.id,200,{currency:'INR',payment_terms_days:0});
    const paid = await send('PATCH',url+'/status',200,{status:'paid'});
    assert.deepEqual([paid.paid_on,paid.currency,paid.total_minor],['2026-01-31','INR','2']);
    assert.deepEqual(await send('GET',url,200),paid);
    assert.equal((await send('GET','/invoices?status=paid&client_id='+client.id,200)).length,1);
    await send('PATCH',url+'/status',409,{status:'draft'});
    await send('DELETE',url,409);
  });
  it('serializes competing selections and allocates distinct yearly sequence numbers',async () => {
    const {project:a} = await fixtures(), {project:b} = await fixtures();
    await add(a.id); await add(b.id);
    const create = (id:number) => call('POST',make,{...range(id),issue_date:'2027-01-01'});
    const results = await Promise.all([create(a.id),create(a.id),create(b.id)]);
    assert.deepEqual(results.map(r => r.status).sort(),[201,201,422]);
    assert.deepEqual(results.filter(r => r.status===201).map(r => r.body.number).sort(),['INV-2027-0001','INV-2027-0002']);
  });
  it('rolls back the counter, draft and attachments when line insertion fails',async () => {
    const {project} = await fixtures();
    const entry = await add(project.id);
    await db.query("ALTER TABLE invoice_lines ADD CONSTRAINT test_line_failure CHECK (description <> 'Guide') NOT VALID");
    const body = {...range(project.id),issue_date:'2028-01-01'};
    try { await send('POST',make,500,body); }
    finally { await db.query('ALTER TABLE invoice_lines DROP CONSTRAINT test_line_failure'); }
    assert.equal((await send('GET','/time-entries/'+entry.id,200)).invoice_id,null);
    assert.equal((await send('POST',make,201,body)).number,'INV-2028-0001');
  });
});
