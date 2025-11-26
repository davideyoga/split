import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./page/home/home').then((m) => m.Home),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  /*
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  */
];
