import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

// Una spesa in attesa, come la vede chi la deve accettare.
export interface PendingExpense {
  publicId: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  categorySlug: string | null;
  // La mia quota.
  share: string;
}

// Le richieste ricevute (GET /api/friend/requests): per ogni persona le sue
// spese in attesa, che si accettano tutte insieme diventando amici, e gli
// inviti ai gruppi, ognuno da solo.
export interface FriendRequests {
  people: { user: User; expenses: PendingExpense[] }[];
  groups: { publicId: string; name: string; memberCount: number; invitedBy: User | null }[];
}

/**
 * Amici (2026-10-25). Una spesa con chi non e' ancora amico resta in attesa
 * finche' non la accetta; accettando si diventa amici. Vedi CLAUDE.md,
 * "Friends".
 */
@Injectable({
  providedIn: 'root',
})
export class FriendService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/friend`);
  }

  requests(): Observable<FriendRequests> {
    return this.http.get<FriendRequests>(`${this.baseUrl}/friend/requests`);
  }

  // Accetta la persona: amici, e tutte le sue spese in attesa contano.
  accept(userPublicId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/friend/${userPublicId}/accept`, {});
  }
}
