import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Ledger, type Client, type Currency } from '../api/ledger';
import { EditorState, put } from './editor-state';

@Component({imports:[ReactiveFormsModule],templateUrl:'./clients.html'})
export class ClientsPage {
  readonly state = new EditorState();
  readonly rows = signal<Client[]>([]);
  readonly loaded = signal(false);
  private readonly api = inject(Ledger);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly form = this.fb.group({
    name:['',[Validators.required,Validators.pattern(/\S/),Validators.maxLength(200)]],
    email:['',[Validators.required,Validators.email,Validators.maxLength(254)]],
    currency:this.fb.control<Currency>('INR'),
    payment_terms_days:[14,[Validators.required,Validators.min(0),Validators.max(3650),Validators.pattern(/^\d+$/)]]
  });
  constructor() { this.load(); }
  load() { this.state.run(this.api.clients(),rows=>{this.rows.set(rows);this.loaded.set(true);}); }
  edit(row?:Client) {
    this.form.reset(row ?? {name:'',email:'',currency:'INR',payment_terms_days:14});
    this.state.begin(row?.id ?? null);
  }
  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.state.busy()) return;
    const value=this.form.getRawValue();
    const body={...value,name:value.name.trim(),email:value.email.trim()};
    const id=this.state.editing();
    this.state.run(id===null?this.api.addClient(body):this.api.editClient(id,body),row=>{
      this.rows.update(rows=>put(rows,row)); this.state.close(); this.state.notice.set('Client saved.');
    });
  }
}
