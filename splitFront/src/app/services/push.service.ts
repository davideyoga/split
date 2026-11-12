import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { safeReturnUrl } from '../utils/return-url';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';
import { NotificationService } from './notification.service';

/**
 * Stato delle push su questo browser, per l'interruttore del Profilo:
 * - `loading`: non si sa ancora (o nessuno e' loggato);
 * - `unavailable`: spente sul server (PUSH_TRANSPORT=off), il Profilo non le mostra;
 * - `unsupported`: il browser non le permette (niente service worker, cioe'
 *   in sviluppo, o iPhone senza l'app sulla schermata Home);
 * - `denied`: l'utente le ha bloccate nelle impostazioni del browser;
 * - `off` / `on`.
 */
export type PushState = 'loading' | 'unavailable' | 'unsupported' | 'denied' | 'off' | 'on';

// Di chi e' l'iscrizione di questo browser. Serve a mostrare subito lo stato
// (il service worker puo' registrarsi fino a 30 s dopo l'avvio, vedi main.ts),
// e a non passare all'utente che entra dopo le push del precedente se il
// logout non ha potuto togliere l'iscrizione (offline).
const OWNER_KEY = 'split.pushOwner';

/**
 * Push Web della PWA (doc/NotifichePush.md). Il browser si iscrive con
 * SwPush (service worker di Angular, solo nella build di produzione) e manda
 * l'iscrizione al backend, che manda le push delle notifiche nuove nella
 * lingua scelta qui. Si accendono e spengono dal Profilo, per dispositivo.
 */
@Injectable({
  providedIn: 'root',
})
export class PushService {
  private http = inject(HttpClient);
  private swPush = inject(SwPush);
  private router = inject(Router);
  private injector = inject(Injector);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private notificationService = inject(NotificationService);
  private baseUrl = `${environment.apiUrl}/notification/push`;

  readonly state = signal<PushState>('loading');

  private vapidPublicKey: string | null = null;
  // L'endpoint di questo browser, per toglierlo dal server al logout con una
  // richiesta che parte subito, col token ancora valido.
  private endpoint: string | null = null;
  // L'utente ha gia' usato l'interruttore: la verifica di onUserChange, che
  // aspetta il service worker, non deve rimettere lo stato di prima.
  private changedByUser = false;

  /** Da AppComponent, una volta. */
  init() {
    // A ogni login, logout o cambio di utente.
    effect(
      () => {
        const user = this.authService.currentUser();
        untracked(() => void this.onUserChange(user?.publicId ?? null));
      },
      { injector: this.injector },
    );

    // Cambio lingua dal Profilo: le push seguono la lingua dell'app.
    effect(
      () => {
        this.languageService.current();
        untracked(() => {
          if (this.state() === 'on') {
            void this.syncSubscription();
          }
        });
      },
      { injector: this.injector },
    );

    if (!this.swPush.isEnabled) {
      return;
    }
    // Tocco su una notifica con l'app gia' aperta: il service worker la porta
    // in primo piano, qui si apre la pagina (ad app chiusa la apre lui).
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) {
        void this.router.navigateByUrl(safeReturnUrl(url));
      }
    });
    // Una push arrivata con l'app aperta: la campanella si aggiorna subito.
    this.swPush.messages.subscribe(() => this.notificationService.refreshCount());
    // Il browser ha rinnovato l'iscrizione da solo.
    this.swPush.pushSubscriptionChanges.subscribe(({ newSubscription }) => {
      if (newSubscription && this.state() === 'on') {
        void this.register(newSubscription).catch(() => undefined);
      }
    });
  }

  /**
   * Dall'interruttore del Profilo, cioe' da un tocco: Safari chiede il
   * permesso solo cosi'. Se l'utente nega il permesso lo stato diventa
   * `denied` senza errore; un altro problema (rete, server) lancia.
   */
  async enable(): Promise<void> {
    const owner = this.authService.currentUser()?.publicId;
    if (!this.vapidPublicKey || !owner) {
      throw new Error('Push non disponibili');
    }
    this.changedByUser = true;
    try {
      const subscription = await this.subscribeBrowser(this.vapidPublicKey);
      try {
        await this.register(subscription);
      } catch (error) {
        // Il server non l'ha salvata: niente iscrizione a meta'.
        await this.swPush.unsubscribe().catch(() => undefined);
        this.endpoint = null;
        throw error;
      }
      writeOwner(owner);
      this.state.set('on');
    } catch (error) {
      this.state.set(permission() === 'denied' ? 'denied' : 'off');
      if (permission() !== 'denied') {
        throw error;
      }
    }
  }

  async disable(): Promise<void> {
    this.changedByUser = true;
    this.forgetDevice();
    writeOwner(null);
    this.state.set('off');
    await this.swPush.unsubscribe().catch(() => undefined);
  }

  /**
   * Da chiamare prima del logout dal Profilo, finche' la sessione vale: toglie
   * questo browser dal server. L'iscrizione nel browser la toglie poi
   * onUserChange quando l'utente diventa null.
   */
  forgetDevice(): void {
    if (this.endpoint) {
      this.http
        .post(`${this.baseUrl}/unsubscribe`, { endpoint: this.endpoint })
        .subscribe({ error: () => undefined });
      this.endpoint = null;
    }
  }

  private async onUserChange(userPublicId: string | null) {
    this.state.set('loading');
    this.vapidPublicKey = null;
    this.endpoint = null;
    this.changedByUser = false;

    if (!userPublicId) {
      // Logout (anche per sessione scaduta): questo browser non riceve piu'
      // niente. Il server la toglie da se' alla prima push rifiutata.
      if (readOwner()) {
        writeOwner(null);
        await this.swPush.unsubscribe().catch(() => undefined);
      }
      return;
    }

    try {
      const config = await firstValueFrom(
        this.http.get<{ vapidPublicKey: string | null }>(`${this.baseUrl}/config`),
      );
      this.vapidPublicKey = config.vapidPublicKey;
    } catch {
      this.vapidPublicKey = null;
    }
    if (!this.isCurrentUser(userPublicId)) {
      return;
    }
    if (!this.vapidPublicKey) {
      this.state.set('unavailable');
      return;
    }
    if (!this.swPush.isEnabled || !('PushManager' in window) || !('Notification' in window)) {
      this.state.set('unsupported');
      return;
    }
    if (permission() === 'denied') {
      this.state.set('denied');
      return;
    }

    // Lo stato subito, da quello che il browser ricorda; poi lo si verifica
    // con il service worker, che puo' arrivare piu' tardi.
    this.state.set(readOwner() === userPublicId ? 'on' : 'off');
    const subscription = await firstValueFrom(this.swPush.subscription);
    if (!this.isCurrentUser(userPublicId) || this.state() === 'loading' || this.changedByUser) {
      return;
    }
    if (subscription && readOwner() === userPublicId) {
      // A ogni avvio si rimanda l'iscrizione: lingua aggiornata, e il server
      // la ritrova anche se nel frattempo l'aveva tolta.
      this.endpoint = subscription.endpoint;
      void this.register(subscription).catch(() => undefined);
      return;
    }
    if (subscription) {
      // Iscrizione di un altro utente rimasta nel browser.
      await this.swPush.unsubscribe().catch(() => undefined);
    }
    writeOwner(null);
    if (this.state() === 'on') {
      this.state.set('off');
    }
  }

  private isCurrentUser(userPublicId: string): boolean {
    return this.authService.currentUser()?.publicId === userPublicId;
  }

  private async syncSubscription() {
    const subscription = await firstValueFrom(this.swPush.subscription);
    if (subscription) {
      await this.register(subscription).catch(() => undefined);
    }
  }

  // Un browser gia' iscritto con un'altra chiave (chiavi VAPID cambiate sul
  // server) rifiuta la nuova iscrizione: si toglie la vecchia e si riprova.
  private async subscribeBrowser(serverPublicKey: string): Promise<PushSubscription> {
    try {
      return await this.swPush.requestSubscription({ serverPublicKey });
    } catch (error) {
      if (permission() === 'denied' || !(await firstValueFrom(this.swPush.subscription))) {
        throw error;
      }
      await this.swPush.unsubscribe();
      return this.swPush.requestSubscription({ serverPublicKey });
    }
  }

  private async register(subscription: PushSubscription): Promise<void> {
    const { endpoint, keys } = subscription.toJSON();
    this.endpoint = endpoint ?? null;
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/subscribe`, {
        endpoint,
        keys,
        locale: this.languageService.current(),
      }),
    );
  }
}

function permission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(publicId: string | null) {
  try {
    if (publicId) {
      localStorage.setItem(OWNER_KEY, publicId);
    } else {
      localStorage.removeItem(OWNER_KEY);
    }
  } catch {
    // Storage non disponibile: al prossimo avvio l'iscrizione si rifa' dal Profilo.
  }
}

/** iPhone o iPad con Split aperto in Safari e non dalla schermata Home: le push li' non esistono. */
export function needsHomeScreenInstall(): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
