import { inject, Injector } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

// Aggiunge il Bearer token, avvisa quando l'API risponde "troppe richieste"
// (429 RATE_LIMITED) e gestisce la sessione scaduta: un 401 su una
// richiesta autenticata (sessione scaduta, chiusa da un altro dispositivo o
// token di una versione precedente dell'app) fa
// logout e riporta al login con returnUrl, invece di lasciare ai service il
// loro `catchError -> of([])` che mostrerebbe solo liste vuote.

// Un solo avviso "troppe richieste" alla volta: una pagina che carica tre
// liste insieme riceverebbe tre 429.
const RATE_LIMIT_TOAST_GAP_MS = 5000;
let lastRateLimitToast = 0;

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
      // Solo richieste che portavano un token: gli errori delle rotte di login
      // (codice sbagliato, troppi tentativi) non sono una sessione scaduta.
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
      // Limite di frequenza dell'API (RateLimitInterceptor nel backend). Solo
      // il suo `code`: il 429 del login e quello della ricerca utenti li
      // mostrano le loro pagine.
      if (
        err instanceof HttpErrorResponse &&
        err.status === 429 &&
        (err.error as { code?: string } | null)?.code === 'RATE_LIMITED' &&
        Date.now() - lastRateLimitToast > RATE_LIMIT_TOAST_GAP_MS
      ) {
        lastRateLimitToast = Date.now();
        injector.get(TranslateService).get('common.rate-limited').subscribe(async (message: string) => {
          const toast = await toastCtrl.create({
            message,
            duration: 4000,
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
