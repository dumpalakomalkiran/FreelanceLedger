import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Clock } from '../clock.ts';
import { catalog } from '../services/catalog.ts';
import { invoices } from '../services/invoices.ts';
import * as input from './input.ts';
import type { Fields } from '../repositories/catalog.ts';
import { conflict } from '../errors.ts';

export function ledger(pool: Pool, clock: Clock) {
  const router = Router();
  const data = catalog(pool);
  const billing = invoices(pool,clock);
  const nonempty = (v: object) => Object.keys(v).length > 0;
  router.get('/clients',async (_req,res) => { res.json(await data.clients()); });
  router.get('/projects',async (req,res) => { res.json(await data.projects(input.projectFilter.parse(req.query))); });
  router.get('/time-entries',async (req,res) => { res.json(await data.entries(input.entryFilter.parse(req.query))); });
  for (const [path,table,schema] of [
    ['/clients','clients',input.client], ['/projects','projects',input.project], ['/time-entries','time_entries',input.entry]
  ] as const) {
    router.get(path+'/:id',async (req,res) => { res.json(await data.get(table,input.paramId.parse(req.params.id))); });
    router.post(path,async (req,res) => { res.status(201).json(await data.write(table,schema.parse(req.body))); });
    const optionalFields: z.ZodType<Fields> = schema.partial();
    const patch = optionalFields.refine(nonempty,'Supply at least one field.');
    router.patch(path+'/:id',async (req,res) => {
      res.json(await data.write(table,patch.parse(req.body),input.paramId.parse(req.params.id)));
    });
  }
  router.delete('/time-entries/:id',async (req,res) => {
    await data.removeEntry(input.paramId.parse(req.params.id)); res.sendStatus(204);
  });
  router.get('/invoices',async (req,res) => { res.json(await billing.list(input.invoiceFilter.parse(req.query))); });
  router.post('/invoices/from-unbilled-time',async (req,res) => {
    res.status(201).json(await billing.create(input.fromTime.parse(req.body)));
  });
  router.get('/invoices/:id',async (req,res) => { res.json(await billing.detail(input.paramId.parse(req.params.id))); });
  const transition = z.object({status:z.string()}).strict();
  router.patch('/invoices/:id/status',async (req,res) => {
    const id = input.paramId.parse(req.params.id);
    const requested = input.status.safeParse(transition.parse(req.body).status);
    if (!requested.success) conflict('Invalid invoice status transition.');
    res.json(await billing.transition(id,requested.data));
  });
  router.delete('/invoices/:id',async (req,res) => {
    await billing.remove(input.paramId.parse(req.params.id)); res.sendStatus(204);
  });
  return router;
}
