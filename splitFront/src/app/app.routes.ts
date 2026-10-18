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
        path: 'activity/expense/:expensePublicId',
        loadComponent: () =>
          import('./pages/expense-detail/expense-detail.page').then(
            (m) => m.ExpenseDetailPage,
          ),
      },
      // Spese per categoria, aperta toccando "Speso questo mese" in Attivita'.
      {
        path: 'activity/spending',
        loadComponent: () =>
          import('./pages/spending/spending.page').then((m) => m.SpendingPage),
      },
      // Le spese di una categoria in un periodo, aperta da una riga della
      // pagina Spese (categoria e periodo nei query param).
      {
        path: 'activity/spending/category',
        loadComponent: () =>
          import('./pages/spending-category/spending-category.page').then(
            (m) => m.SpendingCategoryPage,
          ),
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
        path: 'groups/:publicId/settings',
        loadComponent: () =>
          import('./pages/groups/group-settings/group-settings.page').then(
            (m) => m.GroupSettingsPage,
          ),
      },
      // Stesso dettaglio spesa di activity/expense/:expensePublicId, ma dentro la tab
      // Gruppi: aperto dal gruppo, non fa saltare l'utente in un'altra tab.
      {
        path: 'groups/:publicId/expense/:expensePublicId',
        loadComponent: () =>
          import('./pages/expense-detail/expense-detail.page').then(
            (m) => m.ExpenseDetailPage,
          ),
      },
      {
        path: 'balances',
        loadComponent: () =>
          import('./pages/balances/balances.page').then((m) => m.BalancesPage),
      },
    ],
  },
  // Il Profilo e' fuori dalla shell a tab: si apre dall'icona in alto a destra
  // delle tre pagine principali e torna indietro con la freccia. Fuori dalla
  // shell non eredita l'authGuard di `tabs`, quindi ha il suo.
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
    canActivate: [authGuard],
  },
  // Compatibilita' con i vecchi link / deep link. La nuova spesa non e' piu' una
  // rotta ma una modale (pages/expense-form), aperta dai FAB.
  { path: 'home', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: 'add-expense', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: 'groups', redirectTo: 'tabs/groups', pathMatch: 'full' },
  { path: 'groups/:publicId', redirectTo: 'tabs/groups/:publicId', pathMatch: 'full' },
  // Il Profilo era una tab fino al 2026-10-18.
  { path: 'tabs/profile', redirectTo: 'profile', pathMatch: 'full' },
  { path: '', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/activity' },
];
