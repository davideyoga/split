import { Component, inject } from '@angular/core';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { catchError, filter, forkJoin, of, take } from 'rxjs';

import { AppUpdateService } from './services/app-update.service';
import { LanguageService } from './services/language.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private router = inject(Router);
  private translate = inject(TranslateService);

  constructor() {
    // La lingua non e' piu' forzata a 'en': la decide LanguageService.
    inject(LanguageService).init();
    inject(AppUpdateService).init();
    this.hideBootSplashWhenReady();
  }

  // Lo splash di index.html copre l'avvio: il download del JS, poi quello
  // della prima pagina (lazy) e delle traduzioni. Senza, con poca rete si
  // vedeva una pagina bianca, o barre senza testo. Si toglie quando la prima
  // navigazione e' finita e le traduzioni ci sono; un errore di una delle due
  // lo toglie comunque, per non lasciare l'app bloccata dietro il logo. Da li'
  // in poi l'attesa dei dati la mostrano gli scheletri delle pagine.
  private hideBootSplashWhenReady() {
    const firstNavigation$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd || event instanceof NavigationError),
      take(1),
    );
    const translations$ = this.translate.get('tabs.activity').pipe(
      take(1),
      catchError(() => of(null)),
    );
    forkJoin([firstNavigation$, translations$]).subscribe(() => {
      const splash = document.getElementById('boot-splash');
      if (!splash) return;
      splash.classList.add('hidden');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      // Senza transizione (es. animazioni ridotte dal sistema) transitionend
      // non arriva.
      setTimeout(() => splash.remove(), 400);
    });
  }
}
