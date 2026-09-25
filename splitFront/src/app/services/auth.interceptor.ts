import { inject, Injector } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

// Aggiunge il Bearer token e gestisce la sessione scaduta: un 401 su una
// richiesta autenticata (token scaduto, non valido o JWT_SECRET ruotato) fa
// logout e riporta al login con returnUrl, invece di lasciare ai service il
// loro `catchError -> of([])` che mostrerebbe solo liste vuote.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const navCtrl = inject(NavController);
  const toastCtrl = inject(ToastController);
  // TranslateService NON va iniettato qui: il suo costruttore scarica le
  // traduzioni via HttpClient, quindi passa da questo interceptor mentre e'
  // ancora in costruzione -> dipendenza circolare, che ngx-translate inghiotte
  // in silenzio (nessuna traduzione caricata, pipe sulle chiavi grezze).
  // Lo si recupera dall'injector solo quando serve, cioe' su un 401.
  const injector = inject(Injector);

  const token = authService.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      // Solo richieste che portavano un token: POST /auth/login risponde 401
      // anche per un'email sconosciuta, e quello non e' una sessione scaduta.
      // `getToken()` riletto qui: se piu' richieste in parallelo falliscono
      // insieme, solo la prima trova ancora il token e fa redirect + toast.
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        token &&
        authService.getToken()
      ) {
        authService.logout();
        const returnUrl = router.url.startsWith('/login') ? undefined : router.url;
        // navigateRoot azzera lo stack di Ionic: le pagine della sessione
        // precedente non restano montate (con i loro dati) sotto il login.
        navCtrl.navigateRoot(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
        // get() e non instant(): il 401 piu' tipico arriva all'avvio dell'app,
        // quando i file di traduzione possono essere ancora in caricamento.
        injector.get(TranslateService).get('session.expired').subscribe(async (message: string) => {
          const toast = await toastCtrl.create({
            message,
            duration: 3000,
            position: 'bottom',
            color: 'warning',
          });
          await toast.present();
        });
      }
      return throwError(() => err);
    }),
  );
};
