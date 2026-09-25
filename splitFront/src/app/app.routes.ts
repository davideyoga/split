import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'activity', pathMatch: 'full' },
      {
        path: 'activity',
        loadComponent: () =>
          import('./pages/activity/activity.page').then((m) => m.ActivityPage),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./pages/groups/group-list/group-list').then((m) => m.GroupList),
      },
      {
        path: 'groups/:publicId',
        loadComponent: () =>
          import('./pages/groups/group-detail/group-detail').then(
            (m) => m.GroupDetail,
          ),
      },
      {
        path: 'balances',
        loadComponent: () =>
          import('./pages/balances/balances.page').then((m) => m.BalancesPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  // `add-expense` resta una pagina reale finche' la fase 2 non la sostituisce
  // con una modale; per ora e' il target del FAB di Attivita'.
  {
    path: 'add-expense',
    loadComponent: () =>
      import('./pages/add-expense/add-expense').then((m) => m.addExpense),
    canActivate: [authGuard],
  },
  // Compatibilita' con i vecchi link / deep link.
  { path: 'home', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: 'groups', redirectTo: 'tabs/groups', pathMatch: 'full' },
  { path: 'groups/:publicId', redirectTo: 'tabs/groups/:publicId', pathMatch: 'full' },
  { path: '', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/activity' },
];
