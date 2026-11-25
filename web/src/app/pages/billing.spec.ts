import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {ActivatedRoute,convertToParamMap,provideRouter,Router} from '@angular/router';
import {of} from 'rxjs';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TimePage} from './time';
import {InvoicesPage} from './invoices';
import {InvoiceDetailPage} from './invoice-detail';
import type {Entry,Detail} from '../api/ledger';

const client={id:1,name:'Cedar',currency:'INR',email:'hello@example.com',payment_terms_days:14};
const project={id:2,name:'Guide',client_id:1,archived:false,default_hourly_rate_minor:'1500'};
const entry:Entry={id:3,project_id:2,description:'Research',entry_date:'2026-02-01',billable:true,minutes:60,hourly_rate_override_minor:null,invoice_id:null};
const invoice:Detail={id:4,client_id:1,number:'INV-2026-0001',currency:'INR',status:'draft',issue_date:'2026-02-01',due_date:'2026-02-15',
  tax_rate_bps:1000,tax_minor:'150',subtotal_minor:'1500',total_minor:'1650',created_at:'2026-02-01T00:00:00Z',paid_on:null,
  lines:[{id:1,invoice_id:4,description:'Guide',unit_rate_minor:'1500',amount_minor:'1500',quantity_minutes:'60'}]};
let http:HttpTestingController;
beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),
    {provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:'4'})),snapshot:{}}}]});
  http=TestBed.inject(HttpTestingController);
});
afterEach(()=>{http.verify();vi.restoreAllMocks();});
function refs(){http.expectOne('/api/projects').flush([project]);http.expectOne('/api/clients').flush([client]);}
it('filters time inclusively, keeps attached entries locked and saves exact overrides',()=>{
  const f=TestBed.createComponent(TimePage),p=f.componentInstance;
  http.expectOne('/api/time-entries').flush([entry,{...entry,id:5,invoice_id:4}]);http.expectOne('/api/projects').flush([project]);
  p.filters.patchValue({from:entry.entry_date,to:entry.entry_date,invoiced:'false'});p.apply();
  expect(p.visible()).toEqual([entry]);p.edit({...entry,invoice_id:4});expect(p.state.open()).toBe(false);
  p.edit(entry);p.form.controls.rate.setValue('0');p.save();
  const req=http.expectOne('/api/time-entries/3');expect(req.request.body.hourly_rate_override_minor).toBe('0');
  req.flush({...entry,hourly_rate_override_minor:'0'});expect(p.state.open()).toBe(false);
  p.edit();p.form.patchValue({project_id:2,entry_date:'2026-02-02',minutes:30,description:'Layout'});p.save();
  const create=http.expectOne('/api/time-entries');expect(create.request.body.hourly_rate_override_minor).toBeNull();
  create.flush({...entry,id:6,entry_date:'2026-02-02'});expect(p.visible()).toHaveLength(1);
});
it('preserves a billing range on 422 and opens the created draft on retry',()=>{
  const f=TestBed.createComponent(InvoicesPage),p=f.componentInstance;
  const nav=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
  http.expectOne('/api/invoices').flush([invoice]);refs();p.status.set('paid');expect(p.visible()).toEqual([]);
  p.state.begin(null);p.form.setValue({project_id:2,from:'2026-02-01',to:'2026-01-31',issue_date:'',tax:'8.25'});
  p.create();http.expectNone('/api/invoices/from-unbilled-time');p.form.controls.to.setValue('2026-02-28');p.create();
  const url='/api/invoices/from-unbilled-time';const req=http.expectOne(url);
  expect(req.request.body).toEqual({project_id:2,from:'2026-02-01',to:'2026-02-28',tax_rate_bps:825});
  req.flush({error:{message:'No billable time.'}},{status:422,statusText:'Unprocessable'});
  expect(p.state.error()).toBe('No billable time.');expect(p.state.open()).toBe(true);
  p.create();http.expectOne(url).flush(invoice);expect(nav).toHaveBeenCalledWith(['/invoices',4]);
});
it('prints the loaded invoice and offers only its next status action',()=>{
  const f=TestBed.createComponent(InvoiceDetailPage),p=f.componentInstance;
  http.expectOne('/api/invoices/4').flush(invoice);http.expectOne('/api/clients').flush([client]);f.detectChanges();
  const screen=()=>f.nativeElement.textContent as string;
  expect(screen()).toContain('₹16.50');expect(screen()).toContain('Mark sent');
  const print=vi.spyOn(window,'print').mockImplementation(()=>{});p.print();expect(print).toHaveBeenCalledOnce();
  p.advance();let req=http.expectOne('/api/invoices/4/status');expect(req.request.body).toEqual({status:'sent'});
  req.flush({...invoice,status:'sent'});f.detectChanges();expect(screen()).not.toContain('Delete draft');
  p.advance();req=http.expectOne('/api/invoices/4/status');expect(req.request.body).toEqual({status:'paid'});
  req.flush({...invoice,status:'paid',paid_on:'2026-02-10'});f.detectChanges();
  expect(screen()).toContain('2026-02-10');expect(screen()).not.toContain('Mark paid');
});
