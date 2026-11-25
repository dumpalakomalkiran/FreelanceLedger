import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

export type Currency = 'INR';
export interface ClientInput {name:string; email:string; payment_terms_days:number}
export interface Client extends ClientInput {id:number; currency:Currency}
export interface ProjectInput {name:string; client_id:number; default_hourly_rate_minor:string}
export interface Project extends ProjectInput {id:number; archived:boolean}
export interface EntryInput {project_id:number; entry_date:string; minutes:number; description:string; billable:boolean; hourly_rate_override_minor:string|null}
export interface Entry extends EntryInput {id:number; invoice_id:number|null}
export type Status = 'draft'|'sent'|'paid';
export interface Invoice {id:number; number:string; client_id:number; currency:Currency; issue_date:string; due_date:string; tax_rate_bps:number; subtotal_minor:string; tax_minor:string; total_minor:string; status:Status; paid_on:string|null; created_at:string}
export interface Line {id:number; invoice_id:number; description:string; quantity_minutes:string; unit_rate_minor:string; amount_minor:string}
export interface Detail extends Invoice {lines:Line[]}
export interface BillingInput {project_id:number; from:string; to:string; issue_date?:string; tax_rate_bps?:number}

@Injectable({providedIn:'root'})
export class Ledger {
  private readonly http = inject(HttpClient);
  clients() {return this.http.get<Client[]>('/api/clients');}
  addClient(body:ClientInput) {return this.http.post<Client>('/api/clients',body);}
  editClient(id:number,body:Partial<ClientInput>) {return this.http.patch<Client>('/api/clients/'+id,body);}
  projects() {return this.http.get<Project[]>('/api/projects');}
  addProject(body:ProjectInput) {return this.http.post<Project>('/api/projects',body);}
  editProject(id:number,body:Partial<ProjectInput & {archived:boolean}>) {return this.http.patch<Project>('/api/projects/'+id,body);}
  entries(params:Record<string,string|number|boolean> = {}) {return this.http.get<Entry[]>('/api/time-entries',{params});}
  addEntry(body:EntryInput) {return this.http.post<Entry>('/api/time-entries',body);}
  editEntry(id:number,body:Partial<EntryInput>) {return this.http.patch<Entry>('/api/time-entries/'+id,body);}
  removeEntry(id:number) {return this.http.delete<void>('/api/time-entries/'+id);}
  invoices(params:Record<string,string|number> = {}) {return this.http.get<Invoice[]>('/api/invoices',{params});}
  invoice(id:number) {return this.http.get<Detail>('/api/invoices/'+id);}
  bill(body:BillingInput) {return this.http.post<Detail>('/api/invoices/from-unbilled-time',body);}
  changeStatus(id:number,status:Status) {return this.http.patch<Detail>('/api/invoices/'+id+'/status',{status});}
  removeInvoice(id:number) {return this.http.delete<void>('/api/invoices/'+id);}
}
export function message(error:unknown):string {
  if (error instanceof HttpErrorResponse && typeof error.error?.error?.message === 'string') return error.error.error.message;
  return 'Could not reach the ledger. Please try again.';
}
