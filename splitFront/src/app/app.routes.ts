import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    canActivate: [authGuard],
  },
  {
    path: 'add-expense',
    loadComponent: () =>
      import('./pages/add-expense/add-expense').then((m) => m.addExpense),
    canActivate: [authGuard],
  },
  {
    path: 'groups',
    loadComponent: () =>
      import('./pages/groups/group-list/group-list').then((m) => m.GroupList),
    canActivate: [authGuard],
  },
  {
    path: 'groups/:publicId',
    loadComponent: () =>
      import('./pages/groups/group-detail/group-detail').then(
        (m) => m.GroupDetail,
      ),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];