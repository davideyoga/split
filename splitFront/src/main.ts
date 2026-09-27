import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import {provideTranslateService} from "@ngx-translate/core";
import {provideTranslateHttpLoader} from "@ngx-translate/http-loader";
import {provideHttpClient, withInterceptors} from "@angular/common/http";
import {authInterceptor} from "./app/services/auth.interceptor";
import {detectInitialLang} from "./app/services/language.service";
import {isDevMode} from "@angular/core";
import {provideServiceWorker} from "@angular/service-worker";


bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json'
      }),
      // Scelta salvata dal Profilo, altrimenti lingua del dispositivo.
      lang: detectInitialLang(),
      fallbackLang: 'en',
    }),
    // PWA: ngsw-worker.js esiste solo nella build `production` (serviceWorker
    // in project.json); in development/e2e il service worker resta spento.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
