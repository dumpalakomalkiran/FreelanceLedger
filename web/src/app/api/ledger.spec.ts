import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {beforeEach,afterEach,it,expect} from 'vitest';
import {Ledger} from './ledger';

let api:Ledger, http:HttpTestingController;
beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  api=TestBed.inject(Ledger);http=TestBed.inject(HttpTestingController);
});
afterEach(()=>http.verify());
it('patches the client selected in the editor',()=>{
  api.editClient(4,{payment_terms_days:0}).subscribe();
  const req=http.expectOne('/api/clients/4');expect(req.request.method).toBe('PATCH');
  expect(req.request.body).toEqual({payment_terms_days:0});req.flush({});
});
it('keeps large project rates as exact strings',()=>{
  const body={client_id:1,name:'Guide',default_hourly_rate_minor:'9223372036854775807'};
  api.addProject(body).subscribe();const req=http.expectOne('/api/projects');
  expect(req.request.method).toBe('POST');expect(req.request.body).toEqual(body);req.flush({...body,id:2,archived:false});
});
it('preserves false filters and sends the invoice status action',()=>{
  api.entries({invoiced:false}).subscribe();http.expectOne('/api/time-entries?invoiced=false').flush([]);
  api.changeStatus(7,'paid').subscribe();const req=http.expectOne('/api/invoices/7/status');
  expect(req.request.body).toEqual({status:'paid'});req.flush({});
});
