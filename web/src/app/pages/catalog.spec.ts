import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach,afterEach,it,expect } from 'vitest';
import { ClientsPage } from './clients';
import { ProjectsPage } from './projects';

const client={id:1,name:'Cedar',email:'cedar@example.com',currency:'INR' as const,payment_terms_days:14};
const project={id:2,name:'Guide',client_id:1,default_hourly_rate_minor:'6500',archived:false};
let http:HttpTestingController;
beforeEach(()=>{
  TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting()]});
  http=TestBed.inject(HttpTestingController);
});
afterEach(()=>http.verify());
it('creates a client from the form and shows the saved row',()=>{
  const f=TestBed.createComponent(ClientsPage);http.expectOne('/api/clients').flush([]);f.detectChanges();
  f.nativeElement.querySelector('.heading button').click();f.detectChanges();
  const inputs=f.nativeElement.querySelectorAll('form input');
  for(const [index,value] of [[0,'Cedar'],[1,'cedar@example.com']] as const){
    inputs[index].value=value;inputs[index].dispatchEvent(new Event('input'));
  }
  f.nativeElement.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
  const req=http.expectOne('/api/clients');expect(req.request.method).toBe('POST');
  expect(req.request.body.payment_terms_days).toBe(14);req.flush({...client,currency:'INR'});f.detectChanges();
  expect(f.nativeElement.querySelector('tbody').textContent).toContain('cedar@example.com');
  expect(f.nativeElement.querySelector('form')).toBeNull();
});
it('preserves client input when saving fails and allows retry',()=>{
  const f=TestBed.createComponent(ClientsPage),page=f.componentInstance;
  http.expectOne('/api/clients').flush([client]);page.edit(client);page.form.controls.name.setValue('Cedar Studio');
  page.save();http.expectOne('/api/clients/1').flush({error:{message:'Try again.'}},{status:409,statusText:'Conflict'});
  f.detectChanges();expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('Try again.');
  expect(page.form.controls.name.value).toBe('Cedar Studio');page.save();
  http.expectOne('/api/clients/1').flush({...client,name:'Cedar Studio'});expect(page.state.open()).toBe(false);
});
it('edits rates in major units and archives and restores the project',()=>{
  const f=TestBed.createComponent(ProjectsPage),page=f.componentInstance;
  http.expectOne('/api/projects').flush([project]);http.expectOne('/api/clients').flush([client]);f.detectChanges();
  expect(f.nativeElement.querySelector('tbody').textContent).toContain('₹65.00');
  page.edit(project);page.form.controls.rate.setValue('70.25');page.save();
  const edit=http.expectOne('/api/projects/2');expect(edit.request.body.default_hourly_rate_minor).toBe('7025');
  const saved={...project,default_hourly_rate_minor:'7025'};edit.flush(saved);
  page.archive(saved);const archive=http.expectOne('/api/projects/2');expect(archive.request.body).toEqual({archived:true});
  archive.flush({...saved,archived:true});expect(page.visible()).toEqual([]);page.showArchived.set(true);
  page.archive(page.visible()[0]);http.expectOne('/api/projects/2').flush(saved);expect(page.visible()).toEqual([]);
});
it('rejects invalid rates before sending a request',()=>{
  const f=TestBed.createComponent(ProjectsPage),page=f.componentInstance;
  http.expectOne('/api/projects').flush([]);http.expectOne('/api/clients').flush([client]);
  page.edit();page.form.setValue({name:'Guide',client_id:1,rate:'3.141'});page.save();
  expect(page.form.invalid).toBe(true);http.expectNone('/api/projects');
});
