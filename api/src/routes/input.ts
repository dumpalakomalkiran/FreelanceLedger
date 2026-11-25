import { z } from 'zod';
import { maxMinor } from '../domain/money.ts';

const id = z.number().int().positive().max(2147483647);
export const paramId = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(id);
const money = z.string().regex(/^(0|[1-9]\d{0,18})$/).refine(v => /^\d{1,19}$/.test(v) && BigInt(v) <= maxMinor);
const name = z.string().trim().min(1).max(200);
const date = z.string().date().refine(v => !v.startsWith('0000'));
export const status = z.enum(['draft','sent','paid']);
export const client = z.object({ name, email: z.string().trim().email().max(254), currency: z.enum(['INR','USD']),
  payment_terms_days: z.number().int().min(0).max(3650).optional() }).strict();
export const project = z.object({name, client_id: id, default_hourly_rate_minor: money, archived: z.boolean().optional()}).strict();
export const entry = z.object({project_id: id, entry_date: date, minutes: id, description: z.string().trim().min(1).max(2000),
  billable: z.boolean().optional(), hourly_rate_override_minor: money.nullable().optional()}).strict();
export const ordered = (v: {from?: string; to?: string}) => !v.from || !v.to || v.from <= v.to;
export const fromTime = z.object({project_id: id, from: date, to: date, issue_date: date.optional(),
  tax_rate_bps: z.number().int().min(0).max(10000).default(0)}).strict().refine(ordered, 'Invalid date range.');
const flag = z.enum(['true','false']).transform(v => v === 'true').optional();
export const projectFilter = z.object({client_id: paramId.optional(), archived: flag}).strict();
export const entryFilter = z.object({client_id: paramId.optional(), project_id: paramId.optional(), from: date.optional(),
  to: date.optional(), billable: flag, invoiced: flag}).strict().refine(ordered, 'Invalid date range.');
export const invoiceFilter = z.object({client_id: paramId.optional(), status: status.optional()}).strict();
export type InvoiceInput = z.infer<typeof fromTime>;
export type ProjectFilter = z.infer<typeof projectFilter>;
export type EntryFilter = z.infer<typeof entryFilter>;
export type InvoiceFilter = z.infer<typeof invoiceFilter>;
