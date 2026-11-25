import {Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';
import {Ledger, type Client, type Project, type Entry, type Invoice, type Status, type Currency} from '../api/ledger';
import {MoneyPipe} from '../shared/money';
import {EditorState} from './editor-state';

interface LedgerData {
  clients: Client[];
  projects: Project[];
  entries: Entry[];
  invoices: Invoice[];
}

function duration(minutes: number) {
  return Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm';
}

export function summarize(data: LedgerData) {
  const groups: {status:Status; label:string}[] = [
    {status:'sent', label:'Pending payment'}, {status:'paid', label:'Paid'}, {status:'draft',label:'Drafts'}
  ];
  const invoiceGroups = groups.map(group => {
    const invoices = data.invoices.filter(i => i.status === group.status);
    const sums = new Map<Currency,bigint>();
    for (const invoice of invoices) {
      sums.set(invoice.currency, (sums.get(invoice.currency) ?? 0n) + BigInt(invoice.total_minor));
    }
    const totals = [...sums].sort(([a],[b]) => a.localeCompare(b))
      .map(([currency,amount]) => ({currency,minor:amount.toString()}));
    return {...group,count:invoices.length,totals};
  });
  const minutes = new Map<number,number>();
  let unbilledMinutes = 0;
  let recordedMinutes = 0;
  for (const entry of data.entries) {
    recordedMinutes += entry.minutes;
    if (entry.billable && entry.invoice_id === null) {
      unbilledMinutes += entry.minutes;
      minutes.set(entry.project_id,(minutes.get(entry.project_id) ?? 0) + entry.minutes);
    }
  }
  const clients = new Map(data.clients.map(c => [c.id,c.name]));
  const work = data.projects.filter(p => minutes.has(p.id))
    .map(p => ({id:p.id,name:p.name,client:clients.get(p.client_id),minutes:minutes.get(p.id)!}))
    .sort((a,b) => b.minutes-a.minutes || a.name.localeCompare(b.name));
  return {clients:data.clients.length,active:data.projects.filter(p=>!p.archived).length,
    projects:data.projects.length,entries:data.entries.length,recorded:duration(recordedMinutes),
    unbilled:duration(unbilledMinutes),invoiceGroups,invoices:data.invoices.length,work};
}

@Component({imports:[RouterLink,MoneyPipe],templateUrl:'./dashboard.html',styleUrl:'./dashboard.css'})
export class DashboardPage {
  private readonly api=inject(Ledger);
  readonly state=new EditorState();
  readonly summary=signal<ReturnType<typeof summarize>|null>(null);
  readonly duration=duration;
  constructor(){this.refresh();}
  refresh(){
    this.state.run(forkJoin({clients:this.api.clients(),projects:this.api.projects(),entries:this.api.entries(),
      invoices:this.api.invoices()}),data=>this.summary.set(summarize(data)));
  }
}
