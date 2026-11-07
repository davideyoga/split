import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { safeReturnUrl } from '../utils/return-url';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getToken()) {
    // Appena registrato: prima sceglie il nickname, poi va dove voleva andare
    // (per esempio un link d'invito aperto prima di avere l'account).
    if (authService.currentUser()?.needsName) {
      return router.createUrlTree(['/welcome'], { queryParams: { returnUrl: state.url } });
    }
    return true;
  }

  // Deep link senza sessione: dopo il login si torna dove si voleva andare.
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** /welcome: serve una sessione, e solo finche' il nickname e' provvisorio. */
export const welcomeGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.getToken()) {
    return router.createUrlTree(['/login']);
  }
  if (!authService.currentUser()?.needsName) {
    return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')));
  }
  return true;
};
