import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getToken()) {
    return true;
  }

  // Deep link senza sessione: dopo il login si torna dove si voleva andare.
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
