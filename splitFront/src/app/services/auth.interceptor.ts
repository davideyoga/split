import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from './auth.service';

// TODO: gestire la risposta 401 (token scaduto, non valido o JWT_SECRET ruotato):
// oggi l'errore arriva ai service, che con `catchError -> of([])` mostrano liste
// vuote invece di riportare l'utente al login. Serve un catchError qui che chiami
// AuthService.logout() e navighi a /login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
