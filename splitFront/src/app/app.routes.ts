import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'add-expense',
    loadComponent: () =>
      import('./pages/add-expense/add-expense').then((m) => m.addExpense),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];