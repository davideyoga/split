import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AppNotification } from '../models/notification.model';
import { AuthService } from './auth.service';

/**
 * Notifiche e numero sulla campanella (components/notification-bell).
 *
 * Niente tempo reale: il numero si ricarica quando si entra in una pagina
 * principale (Attivita', Gruppi, Saldi chiamano refreshCount nel loro
 * ionViewWillEnter), quando l'app torna in primo piano, dopo aver aperto la
 * lista e, con le push accese, quando ne arriva una (PushService).
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = environment.apiUrl;

  readonly unreadCount = signal(0);

  constructor() {
    // Il numero e' di chi e' loggato ora: al logout (o al login di un altro)
    // non deve restare quello di prima. Lo ricarica la prima pagina che si apre.
    effect(() => {
      this.authService.currentUser();
      untracked(() => this.unreadCount.set(0));
    });

    // Un'app installata resta in background per giorni (come in
    // app-update.service.ts).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshCount();
      }
    });
  }

  refreshCount(): void {
    const token = this.authService.getToken();
    if (!token) {
      return;
    }
    this.http.get<{ count: number }>(`${this.baseUrl}/notification/unread-count`).subscribe({
      next: ({ count }) => {
        // Risposta arrivata dopo un logout: era di un altro utente.
        if (this.authService.getToken() === token) {
          this.unreadCount.set(count);
        }
      },
      // Il 401 lo gestisce l'interceptor; per il resto resta il numero di prima.
      error: () => undefined,
    });
  }

  list(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.baseUrl}/notification`);
  }

  /** Segna come lette quelle mostrate; risponde con quante ne restano. */
  markRead(publicIds: string[]): Observable<{ count: number }> {
    return this.http
      .post<{ count: number }>(`${this.baseUrl}/notification/read`, { publicIds })
      .pipe(tap(({ count }) => this.unreadCount.set(count)));
  }
}
