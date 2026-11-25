import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {it,expect} from 'vitest';
import {routes} from './shell';

it('opens the dashboard at the root and lazy-loads Projects',async()=>{
  TestBed.configureTestingModule({providers:[provideRouter(routes),provideHttpClient(),provideHttpClientTesting()]});
  const view=await RouterTestingHarness.create('/');
  const http=TestBed.inject(HttpTestingController);http.expectOne('/api/clients').flush([]);
  http.expectOne('/api/projects').flush([]);http.expectOne('/api/time-entries').flush([]);http.expectOne('/api/invoices').flush([]);
  view.detectChanges();
  expect(view.routeNativeElement?.querySelector('h1')?.textContent).toBe('Dashboard');
  expect(view.routeNativeElement?.textContent).toContain('All billable time has been accounted for.');
  await view.navigateByUrl('/projects');
  http.expectOne('/api/projects').flush([]);http.expectOne('/api/clients').flush([]);
  expect(view.routeNativeElement?.querySelector('h1')?.textContent).toBe('Projects');http.verify();
});
