import { Component } from '@angular/core';
import { Routes, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

export const routes: Routes = [
  {path:'dashboard',title:'Dashboard · FreelanceLedger',loadComponent:()=>import('./pages/dashboard').then(m=>m.DashboardPage)},
  {path:'time',title:'Time · FreelanceLedger',loadComponent:()=>import('./pages/time').then(m=>m.TimePage)},
  {path:'invoices/:id',title:'Invoice · FreelanceLedger',loadComponent:()=>import('./pages/invoice-detail').then(m=>m.InvoiceDetailPage)},
  {path:'invoices',title:'Invoices · FreelanceLedger',loadComponent:()=>import('./pages/invoices').then(m=>m.InvoicesPage)},
  {path:'clients',title:'Clients · FreelanceLedger',loadComponent:() => import('./pages/clients').then(m => m.ClientsPage)},
  {path:'projects',title:'Projects · FreelanceLedger',loadComponent:() => import('./pages/projects').then(m => m.ProjectsPage)},
  {path:'',pathMatch:'full',redirectTo:'dashboard'},
  {path:'**',redirectTo:'dashboard'}
];
@Component({selector:'ledger-root',imports:[RouterOutlet,RouterLink,RouterLinkActive],template:`
  <a class="skip" href="#content">Skip to content</a>
  <header><div class="bar"><a class="brand" routerLink="/dashboard">Freelance<span>Ledger</span></a>
    <nav aria-label="Main navigation">
      <a routerLink="/dashboard" routerLinkActive="active" ariaCurrentWhenActive="page">Dashboard</a>
      <a routerLink="/clients" routerLinkActive="active" ariaCurrentWhenActive="page">Clients</a>
      <a routerLink="/projects" routerLinkActive="active" ariaCurrentWhenActive="page">Projects</a>
      <a routerLink="/time" routerLinkActive="active" ariaCurrentWhenActive="page">Time</a>
      <a routerLink="/invoices" routerLinkActive="active" ariaCurrentWhenActive="page">Invoices</a>
    </nav></div></header>
  <main id="content" tabindex="-1"><router-outlet /></main>`})
export class Shell {}
