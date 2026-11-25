import {Component, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';
import {Ledger, type Entry, type Project, type Client} from '../api/ledger';
import {EditorState} from './editor-state';
import {MoneyPipe, parseRate, rateInput} from '../shared/money';

@Component({imports:[ReactiveFormsModule,RouterLink,MoneyPipe],templateUrl:'./time.html'})
export class TimePage {
  private readonly api = inject(Ledger);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly state = new EditorState();
  readonly loaded = signal(false);
  readonly rows = signal<Entry[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly projectMap = computed(()=>new Map(this.projects().map(p=>[p.id,p])));
  readonly currencies = computed(()=>new Map(this.clients().map(c=>[c.id,c.currency])));
  readonly originalProject = signal<number|null>(null);
  readonly available = computed(()=>this.projects().filter(p=>!p.archived || p.id===this.originalProject()));
  readonly active = computed(()=>this.projects().some(p=>!p.archived));
  readonly filters = this.fb.group({project_id:0,from:'',to:'',billable:'',invoiced:''});
  readonly filter = signal(this.filters.getRawValue());
  readonly visible = computed(()=>{
    const f=this.filter();
    return this.rows().filter(e=>(!f.project_id||e.project_id===f.project_id)
      && (!f.from||e.entry_date>=f.from) && (!f.to||e.entry_date<=f.to)
      && (!f.billable||e.billable===(f.billable==='true'))
      && (!f.invoiced||(e.invoice_id!==null)===(f.invoiced==='true')));
  });
  readonly form = this.fb.group({
    project_id:[0,Validators.min(1)], entry_date:['',Validators.required],
    minutes:[60,[Validators.required,Validators.min(1),Validators.max(2147483647),Validators.pattern(/^\d+$/)]],
    description:['',[Validators.required,Validators.pattern(/\S/),Validators.maxLength(2000)]],
    billable:true,rate:['',control=>control.value && parseRate(control.value)===null?{rate:true}:null]
  });
  constructor(){this.load();}
  load(){
    this.state.run(forkJoin({rows:this.api.entries(),projects:this.api.projects(),clients:this.api.clients()}),data=>{
      this.rows.set(data.rows);this.projects.set(data.projects);this.clients.set(data.clients);this.loaded.set(true);
    });
  }
  apply(){
    const f=this.filters.getRawValue();
    if(f.from && f.to && f.from>f.to){this.filters.setErrors({range:true});return;}
    this.filter.set(f);
  }
  edit(e?:Entry){
    if(e?.invoice_id!=null)return;
    this.originalProject.set(e?.project_id??null);
    this.form.reset({project_id:e?.project_id??0,entry_date:e?.entry_date??'',minutes:e?.minutes??60,
      description:e?.description??'',billable:e?.billable??true,rate:e?.hourly_rate_override_minor!=null?rateInput(e.hourly_rate_override_minor):''});
    this.state.begin(e?.id??null);
  }
  save(){
    this.form.markAllAsTouched();
    if(this.form.invalid||this.state.busy())return;
    const {rate,description,...fields}=this.form.getRawValue();
    const body={...fields,description:description.trim(),hourly_rate_override_minor:rate===''?null:parseRate(rate)};
    const id=this.state.editing();
    this.state.run(id===null?this.api.addEntry(body):this.api.editEntry(id,body),row=>{
      this.rows.update(rows=>[...rows.filter(e=>e.id!==row.id),row].sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.id-a.id));
      this.state.close();this.state.notice.set('Time entry saved.');
    });
  }
  remove(e:Entry){
    if(e.invoice_id!==null || !window.confirm('Delete this time entry?'))return;
    this.state.run(this.api.removeEntry(e.id),()=>{
      this.rows.update(rows=>rows.filter(row=>row.id!==e.id));this.state.notice.set('Time entry deleted.');
    });
  }
}
