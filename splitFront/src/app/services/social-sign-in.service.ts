import { inject, Injectable, NgZone } from '@angular/core';

import { environment } from '../../environments/environment';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
const APPLE_SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

// Solo le parti delle due librerie che usiamo (niente @types: una dipendenza
// in meno per due chiamate).
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup' | 'redirect';
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

/** Nome e cognome: Apple li manda solo al primo accesso, e solo qui, non nel token. */
export interface AppleUser {
  name?: { firstName?: string; lastName?: string };
}

interface AppleSignInResponse {
  authorization: { id_token: string };
  user?: AppleUser;
}

interface AppleIdAuth {
  auth: {
    init(config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }): void;
    signIn(): Promise<AppleSignInResponse>;
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
    AppleID?: AppleIdAuth;
  }
}

/**
 * Login con Google e Apple nel browser: ottiene dal provider l'ID token che
 * AuthService.signInWithIdToken scambia con una sessione (vedi
 * splitBack/src/app/auth/auth.factory.ts, socialProviders). Gli script dei
 * provider si caricano solo quando il pulsante serve, cioe' sulla pagina di
 * login.
 *
 * Niente nonce: senza salvarlo sul server non protegge da nulla. Il backend
 * accetta solo token firmati dal provider, per il nostro client ID, emessi da
 * meno di un'ora.
 *
 * Solo web (e PWA): nella WebView di Capacitor Google rifiuta il login e
 * servono plugin nativi (TODO.md).
 */
@Injectable({
  providedIn: 'root',
})
export class SocialSignInService {
  private zone = inject(NgZone);
  private scripts = new Map<string, Promise<void>>();

  readonly googleEnabled = !!environment.googleClientId;
  readonly appleEnabled = !!environment.appleClientId && !!environment.appleRedirectUri;

  /**
   * Disegna in `parent` il pulsante di Google: dev'essere il loro (iframe,
   * regole del marchio), e l'ID token arriva solo da li'. `onToken` gira dentro
   * la zona di Angular: la callback di Google no, e senza la pagina non si
   * aggiornerebbe (come gli handler degli alert).
   */
  async renderGoogleButton(parent: HTMLElement, lang: string, onToken: (idToken: string) => void): Promise<void> {
    await this.loadScript(GOOGLE_SCRIPT);
    const google = window.google;
    if (!google) {
      throw new Error('Google Identity Services non disponibile');
    }
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      ux_mode: 'popup',
      callback: (response) => this.zone.run(() => onToken(response.credential)),
    });
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    google.accounts.id.renderButton(parent, {
      type: 'standard',
      theme: dark ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      // In pixel, fra 200 e 400 (limiti di Google): largo come il pulsante di Apple.
      width: Math.min(400, Math.max(200, parent.clientWidth || 320)),
      locale: lang,
    });
  }

  /** Apre il popup di Apple. `null` se l'utente lo chiude o annulla. */
  async signInWithApple(): Promise<{ idToken: string; user?: AppleUser } | null> {
    await this.loadScript(APPLE_SCRIPT);
    const appleId = window.AppleID;
    if (!appleId) {
      throw new Error('Sign in with Apple JS non disponibile');
    }
    appleId.auth.init({
      clientId: environment.appleClientId,
      scope: 'name email',
      redirectURI: environment.appleRedirectUri,
      usePopup: true,
    });
    try {
      const response = await appleId.auth.signIn();
      return { idToken: response.authorization.id_token, user: response.user };
    } catch (err: unknown) {
      const error = (err as { error?: string } | null)?.error;
      if (error === 'popup_closed_by_user' || error === 'user_cancelled_authorize') {
        return null;
      }
      throw err;
    }
  }

  private loadScript(src: string): Promise<void> {
    let loading = this.scripts.get(src);
    if (!loading) {
      loading = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          // Si potra' riprovare (rete tornata, blocco tolto).
          this.scripts.delete(src);
          script.remove();
          reject(new Error(`Caricamento di ${src} fallito`));
        };
        document.head.appendChild(script);
      });
      this.scripts.set(src, loading);
    }
    return loading;
  }
}
