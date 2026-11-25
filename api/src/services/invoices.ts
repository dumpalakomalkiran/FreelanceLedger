import type { Pool } from 'pg';
import type { Clock } from '../clock.ts';
import { transaction } from '../db/pool.ts';
import { calculate } from '../domain/money.ts';
import { canTransition, type Status } from '../domain/status.ts';
import { conflict, Problem, required } from '../errors.ts';
import type { InvoiceFilter, InvoiceInput } from '../routes/input.ts';
import * as repo from '../repositories/invoices.ts';

export function invoices(pool: Pool, clock: Clock) {
  return {
    list: (f: InvoiceFilter) => repo.list(pool,f),
    detail: (id: number) => transaction(pool, async db => {
      const invoice = required(await repo.header(db,id));
      return {...invoice, lines: await repo.lines(db,id)};
    }),
    create: (input: InvoiceInput) => transaction(pool, async db => {
      const project = required(await repo.project(db,input.project_id));
      const owner = required(await repo.client(db,project.client_id));
      const entries = await repo.eligible(db,input,project.default_hourly_rate_minor);
      if (!entries.length) throw new Problem(422,'NOTHING_TO_BILL','No unbilled time in this date range.');
      let totals: ReturnType<typeof calculate>;
      try { totals = calculate(entries,input.tax_rate_bps); }
      catch (error) {
        if (error instanceof RangeError) throw new Problem(422,'AMOUNT_OUT_OF_RANGE','Invoice exceeds the supported amount.');
        throw error;
      }
      const now = clock.now();
      const issue = input.issue_date ?? now.toISOString().slice(0,10);
      const number = await repo.nextNumber(db,issue.slice(0,4));
      const invoice = await repo.insert(db,number,owner,issue,now,input.tax_rate_bps,totals);
      const lines = await repo.insertLines(db,invoice.id,project.name,totals.lines);
      const attached = await repo.attach(db,entries.map(entry => entry.id),invoice.id);
      if (attached.rowCount !== entries.length) conflict('The selected entries changed.');
      return {...invoice,lines};
    }),
    transition: (id: number,to: Status) => transaction(pool, async db => {
      const current = required(await repo.header(db,id,'update'));
      if (!canTransition(current.status,to)) conflict('Invalid invoice status transition.');
      const date = to === 'paid' ? clock.now().toISOString().slice(0,10) : null;
      const invoice = required(await repo.changeStatus(db,id,current.status,to,date));
      return {...invoice, lines: await repo.lines(db,id)};
    }),
    remove: (id: number) => transaction(pool, async db => {
      const invoice = required(await repo.header(db,id,'update'));
      if (invoice.status !== 'draft') conflict('Only draft invoices can be deleted.');
      await repo.removeDraft(db,id);
    })
  };
}
