import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Shell, routes } from './app/shell';
bootstrapApplication(Shell,{providers:[provideRouter(routes),provideHttpClient()]}).catch(console.error);
