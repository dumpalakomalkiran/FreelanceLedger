import type { Pool } from 'pg';
import { transaction } from '../db/pool.ts';
import { required, conflict } from '../errors.ts';
import * as repo from '../repositories/catalog.ts';

export function catalog(pool: Pool) {
  return {
    clients: () => repo.clients(pool),
    projects: (f: Parameters<typeof repo.projects>[1]) => repo.projects(pool,f),
    entries: (f: Parameters<typeof repo.entries>[1]) => repo.entries(pool,f),
    get: async (table: repo.Table, id: number) => required(await repo.row(pool,table,id)),
    write: (table: repo.Table, data: repo.Fields, id?: number) => transaction(pool, async db => {
      if (table === 'time_entries' && data.project_id !== undefined) {
        const project = required(await repo.row(db,'projects',Number(data.project_id),true));
        if (project.archived && !id) conflict('This project is archived.');
        if (project.archived && id) {
          const original = required(await repo.row(db,table,id,true));
          if (original.project_id !== project.id) conflict('This project is archived.');
        }
      }
      if (id) {
        const current = required(await repo.row(db,table,id,true));
        if (table === 'time_entries' && current.invoice_id != null) conflict('This time entry belongs to an invoice.');
        if (table === 'projects' && data.client_id !== undefined && data.client_id !== current.client_id && await repo.hasEntries(db,id)) {
          conflict('A project with time entries must keep its client.');
        }
      }
      return required(await repo.save(db,table,data,id));
    }),
    removeEntry: (id: number) => transaction(pool, async db => {
      const entry = required(await repo.row(db,'time_entries',id,true));
      if (entry.invoice_id != null) conflict('This time entry belongs to an invoice.');
      await repo.removeEntry(db,id);
    })
  };
}
