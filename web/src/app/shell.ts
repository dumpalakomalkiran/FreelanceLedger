import { Component } from '@angular/core';
import { Routes, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

export const routes: Routes = [
  {path:'clients',title:'Clients · FreelanceLedger',loadComponent:() => import('./pages/clients').then(m => m.ClientsPage)},
  {path:'projects',title:'Projects · FreelanceLedger',loadComponent:() => import('./pages/projects').then(m => m.ProjectsPage)},
  {path:'',pathMatch:'full',redirectTo:'clients'},
  {path:'**',redirectTo:'clients'}
];
@Component({selector:'ledger-root',imports:[RouterOutlet,RouterLink,RouterLinkActive],template:`
  <a class="skip" href="#content">Skip to content</a>
  <header><div class="bar"><a class="brand" routerLink="/clients">Freelance<span>Ledger</span></a>
    <nav aria-label="Main navigation">
      <a routerLink="/clients" routerLinkActive="active" ariaCurrentWhenActive="page">Clients</a>
      <a routerLink="/projects" routerLinkActive="active" ariaCurrentWhenActive="page">Projects</a>
    </nav></div></header>
  <main id="content" tabindex="-1"><router-outlet /></main>`})
export class Shell {}
