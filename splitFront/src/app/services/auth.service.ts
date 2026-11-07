import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import type { AppleUser } from './social-sign-in.service';

const STORAGE_KEY = 'split_auth';

interface StoredAuth {
  // Token di sessione di Better Auth, mandato come Bearer dall'interceptor.
  // Il nome resta quello del vecchio JWT: una sessione salvata da una versione
  // precedente dell'app viene rifiutata con 401 e l'interceptor riporta al login.
  accessToken: string;
  user: User;
}

// Risposta di POST /api/auth/sign-in/email-otp e /sign-in/social: l'utente di
// Better Auth, i cui campi il backend rimappa su User (`name` e' il nickName).
interface SignInResponse {
  token: string;
  user: { publicId: string; name: string; email: string; needsName?: boolean };
}

/**
 * Login senza password: `requestCode` fa mandare un codice di 6 cifre via email,
 * `verifyCode` lo scambia con una sessione; oppure `signInWithIdToken` con il
 * token di Google/Apple (SocialSignInService). Con la registrazione aperta il
 * primo login crea l'account. Vedi splitBack/src/app/auth/.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  private stored: StoredAuth | null = this.readStorage();

  currentUser = signal<User | null>(this.stored?.user ?? null);

  /**
   * Risponde ok anche per un'email non registrata (che riceve il codice solo
   * con la registrazione aperta): dall'esterno non si deve poter scoprire chi
   * ha un account. `lang` sceglie la lingua dell'email.
   */
  requestCode(email: string, lang: string): Observable<void> {
    return this.http
      .post(
        `${this.baseUrl}/auth/email-otp/send-verification-otp`,
        { email, type: 'sign-in' },
        { headers: { 'Accept-Language': lang } },
      )
      .pipe(map(() => undefined));
  }

  verifyCode(email: string, otp: string): Observable<User> {
    return this.http
      .post<SignInResponse>(`${this.baseUrl}/auth/sign-in/email-otp`, { email, otp })
      .pipe(map((response) => this.storeSession(response)));
  }

  /**
   * Login con l'ID token di Google o Apple. Un'email che ha gia' un account
   * (anche creato col codice) ritrova quello: il backend li collega.
   * `appleUser` e' il nome che Apple manda solo al primo accesso.
   */
  signInWithIdToken(provider: 'google' | 'apple', token: string, appleUser?: AppleUser): Observable<User> {
    return this.http
      .post<SignInResponse>(`${this.baseUrl}/auth/sign-in/social`, {
        provider,
        idToken: { token, ...(appleUser && { user: appleUser }) },
      })
      .pipe(map((response) => this.storeSession(response)));
  }

  /**
   * Logout dal Profilo: chiude anche la sessione sul server. La richiesta parte
   * dopo aver svuotato lo stato locale, quindi il token va messo a mano
   * (l'interceptor non lo trova piu'); se fallisce la sessione scade da sola.
   */
  signOut(): void {
    const token = this.getToken();
    this.logout();
    if (token) {
      this.http
        .post(`${this.baseUrl}/auth/sign-out`, {}, { headers: { Authorization: `Bearer ${token}` } })
        .subscribe({ error: () => undefined });
    }
  }

  /**
   * Dopo un cambio del proprio profilo (nickname): aggiorna la copia salvata in
   * localStorage, altrimenti al prossimo avvio l'app mostrerebbe i dati vecchi
   * fino a un nuovo login.
   */
  updateCurrentUser(user: User): void {
    if (!this.stored) {
      return;
    }
    this.stored = { ...this.stored, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored));
    this.currentUser.set(user);
  }

  /** Solo stato locale: usato anche dall'interceptor su un 401, quando la sessione e' gia' morta. */
  logout(): void {
    this.stored = null;
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return this.stored?.accessToken ?? null;
  }

  private storeSession(response: SignInResponse): User {
    const user: User = {
      publicId: response.user.publicId,
      nickName: response.user.name,
      email: response.user.email,
      needsName: response.user.needsName ?? false,
    };
    this.stored = { accessToken: response.token, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored));
    this.currentUser.set(user);
    return user;
  }

  private readStorage(): StoredAuth | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredAuth;
    } catch {
      return null;
    }
  }
}
