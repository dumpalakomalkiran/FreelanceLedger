import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, EMPTY, forkJoin, startWith, Subject, switchMap} from 'rxjs';
import {Ledger, message, type Detail, type Client} from '../api/ledger';
import {MoneyPipe,rateInput} from '../shared/money';
import {EditorState} from './editor-state';

@Component({imports:[MoneyPipe,RouterLink],templateUrl:'./invoice-detail.html'})
export class InvoiceDetailPage {
  private readonly api=inject(Ledger);
  private readonly router=inject(Router);
  readonly state=new EditorState();
  readonly invoice=signal<Detail|null>(null);
  readonly owner=signal<Client|undefined>(undefined);
  readonly loadError=signal('');
  readonly refresh=new Subject<void>();
  readonly percent=rateInput;
  constructor(){
    inject(ActivatedRoute).paramMap.pipe(switchMap(params=>this.refresh.pipe(startWith(undefined),switchMap(()=>{
      this.invoice.set(null);this.loadError.set('');this.state.error.set('');
      const id=params.get('id')??'';
      if(!/^[1-9]\d{0,9}$/.test(id)){this.loadError.set('Invalid invoice number.');return EMPTY;}
      return forkJoin({invoice:this.api.invoice(Number(id)),clients:this.api.clients()}).pipe(catchError(e=>{
        this.loadError.set(message(e));return EMPTY;
      }));
    }))),takeUntilDestroyed()).subscribe(({invoice,clients})=>{
      this.invoice.set(invoice);this.owner.set(clients.find(c=>c.id===invoice.client_id));
    });
  }
  advance(){
    const invoice=this.invoice();if(!invoice || invoice.status==='paid')return;
    this.state.run(this.api.changeStatus(invoice.id,invoice.status==='draft'?'sent':'paid'),saved=>{
      if(this.invoice()?.id===saved.id)this.invoice.set(saved);
    });
  }
  remove(){
    const invoice=this.invoice();
    if(invoice?.status!=='draft'||!window.confirm('Delete this draft and release its time entries?'))return;
    this.state.run(this.api.removeInvoice(invoice.id),()=>{
      if(this.invoice()?.id===invoice.id)void this.router.navigate(['/invoices']);
    });
  }
  print(){window.print();}
}
