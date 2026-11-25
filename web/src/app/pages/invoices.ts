import {Component, computed, inject, signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {type AbstractControl, FormBuilder,ReactiveFormsModule,Validators} from '@angular/forms';
import {forkJoin} from 'rxjs';
import {Ledger,type Client,type Project,type Invoice,type Status} from '../api/ledger';
import {MoneyPipe,parseRate} from '../shared/money';
import {EditorState} from './editor-state';

@Component({imports:[ReactiveFormsModule,RouterLink,MoneyPipe],templateUrl:'./invoices.html'})
export class InvoicesPage {
  private readonly api=inject(Ledger);
  private readonly router=inject(Router);
  readonly state=new EditorState();
  readonly loaded=signal(false);
  readonly rows=signal<Invoice[]>([]);
  readonly clients=signal<Client[]>([]);
  readonly projects=signal<Project[]>([]);
  readonly names=computed(()=>new Map(this.clients().map(c=>[c.id,c.name])));
  readonly status=signal<Status|''>('');
  readonly visible=computed(()=>this.rows().filter(i=>!this.status()||i.status===this.status()));
  readonly statuses=['draft','sent','paid'] as const;
  readonly form=inject(FormBuilder).nonNullable.group({
    project_id:[0,Validators.min(1)], from:['',Validators.required], to:['',Validators.required],
    issue_date:'', tax:['0',(control:AbstractControl<string>)=>{
      const bps=parseRate(control.value);
      return bps!==null && BigInt(bps)<=10000n?null:{tax:true};
    }]
  },{validators:group=>group.value.from && group.value.to && group.value.from>group.value.to?{range:true}:null});
  constructor(){this.load();}
  load(){
    this.state.run(forkJoin({rows:this.api.invoices(),clients:this.api.clients(),projects:this.api.projects()}),data=>{
      this.rows.set(data.rows);this.clients.set(data.clients);this.projects.set(data.projects);this.loaded.set(true);
    });
  }
  create(){
    this.form.markAllAsTouched();
    if(this.form.invalid||this.state.busy())return;
    const {tax,issue_date,...fields}=this.form.getRawValue();
    const bps=parseRate(tax);
    if(bps===null)return;
    this.state.run(this.api.bill({...fields,tax_rate_bps:Number(bps),...(issue_date?{issue_date}:{})}),invoice=>{
      this.rows.update(rows=>[invoice,...rows]);this.form.reset();this.state.close();
      void this.router.navigate(['/invoices',invoice.id]);
    });
  }
}
