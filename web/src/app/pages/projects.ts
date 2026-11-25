import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Ledger, type Project, type Client } from '../api/ledger';
import { MoneyPipe, parseRate, rateInput } from '../shared/money';
import { EditorState, put } from './editor-state';
import { RouterLink } from '@angular/router';

@Component({imports:[ReactiveFormsModule,MoneyPipe,RouterLink],templateUrl:'./projects.html'})
export class ProjectsPage {
  readonly state = new EditorState();
  readonly rows = signal<Project[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly owners = computed(()=>new Map(this.clients().map(c=>[c.id,c])));
  readonly loaded = signal(false);
  readonly showArchived = signal(false);
  readonly visible = computed(()=>this.rows().filter(p=>p.archived===this.showArchived()));
  private readonly api = inject(Ledger);
  readonly form = inject(FormBuilder).nonNullable.group({
    name:['',[Validators.required,Validators.pattern(/\S/),Validators.maxLength(200)]],
    client_id:[0,[Validators.required,Validators.min(1)]],
    rate:['', [Validators.required,control=>parseRate(control.value)===null?{rate:true}:null]]
  });
  constructor() { this.load(); }
  load() {
    this.state.run(forkJoin({projects:this.api.projects(),clients:this.api.clients()}),data=>{
      this.clients.set(data.clients);this.rows.set(data.projects);this.loaded.set(true);
    });
  }
  edit(row?:Project) {
    this.form.reset({name:row?.name??'',client_id:row?.client_id??0,rate:row?rateInput(row.default_hourly_rate_minor):''});
    this.state.begin(row?.id??null);
  }
  save() {
    this.form.markAllAsTouched();
    const {rate,name,client_id}=this.form.getRawValue();
    const minor=parseRate(rate);
    if (this.form.invalid || minor===null || this.state.busy()) return;
    const body={name:name.trim(),client_id,default_hourly_rate_minor:minor};
    const id=this.state.editing();
    this.state.run(id===null?this.api.addProject(body):this.api.editProject(id,body),row=>{
      this.rows.update(rows=>put(rows,row));this.state.close();this.state.notice.set('Project saved.');
    });
  }
  archive(row:Project) {
    this.state.run(this.api.editProject(row.id,{archived:!row.archived}),saved=>{
      this.rows.update(rows=>put(rows,saved));
      this.state.notice.set(saved.name+(saved.archived?' archived.':' restored.'));
    });
  }
}
