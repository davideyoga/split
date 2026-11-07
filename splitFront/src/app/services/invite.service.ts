import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { InviteExpiryDays } from '../utils/invite';

// Il link attivo di un gruppo, senza token: il token si vede solo alla creazione.
export interface ActiveInvite {
  expiresAt: string;
  createdDate: string;
  createdBy: User;
}

export interface InvitePreview {
  groupName: string;
  invitedBy: string;
  memberCount: number;
  expiresAt: string;
  alreadyMember: boolean;
  // Solo per chi e' gia' membro.
  groupPublicId: string | null;
}

// Link d'invito ai gruppi (2026-11-07). Il token viaggia sempre nel body.
@Injectable({ providedIn: 'root' })
export class InviteService {
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  active(groupPublicId: string): Observable<{ invite: ActiveInvite | null }> {
    return this.http.get<{ invite: ActiveInvite | null }>(`${this.baseUrl}/group/${groupPublicId}/invite`);
  }

  // Revoca il link precedente: un solo link attivo per gruppo.
  create(groupPublicId: string, expiresInDays: InviteExpiryDays): Observable<{ token: string; expiresAt: string }> {
    return this.http.post<{ token: string; expiresAt: string }>(`${this.baseUrl}/group/${groupPublicId}/invite`, {
      expiresInDays,
    });
  }

  revoke(groupPublicId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/group/${groupPublicId}/invite`);
  }

  preview(token: string): Observable<InvitePreview> {
    return this.http.post<InvitePreview>(`${this.baseUrl}/invite/preview`, { token });
  }

  join(token: string): Observable<{ groupPublicId: string; joined: boolean }> {
    return this.http.post<{ groupPublicId: string; joined: boolean }>(`${this.baseUrl}/invite/join`, { token });
  }
}
