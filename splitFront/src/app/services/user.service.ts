import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root' // Questo lo rende disponibile ovunque
})

export class UserService {

  // Legge l'URL dal file environment
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient); // Inietta HttpClient

  /**
   * Ricerca esatta per nickname o email: 0 o 1 utenti, mai chi cerca.
   * Niente `catchError → of([])`: con una ricerca esatta un errore di rete
   * mostrato come "nessun utente" farebbe credere che la persona non esista.
   */
  getUsers(searchQuery: string): Observable<User[]> {
    // Query param e non path: HttpClient codifica `/`, `?`, `#` e `..` resta testo.
    return this.http.get<User[]>(`${this.baseUrl}/user`, { params: { q: searchQuery } });
  }

  // Chi condivide gia' con me una spesa o un gruppo, per nickname.
  getContacts(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/user/contacts`);
  }

  // "Blocca" (2026-11-07): chi ho bloccato non mi aggiunge a spese, non mi
  // trova e non mi manda notifiche. Effetti in splitBack/src/app/user/blocks.ts.
  getBlocked(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/user/blocks`);
  }

  block(userPublicId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/user/blocks`, { publicId: userPublicId });
  }

  unblock(userPublicId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/user/blocks/${userPublicId}`);
  }

  /**
   * Cambia il nickname dell'utente loggato. Un errore arriva con
   * `error.code` = NICKNAME_* (regole di utils/nickname.ts, o NICKNAME_TAKEN).
   */
  updateMyNickname(nickName: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/user/me`, { nickName });
  }

  // Definitiva: l'account viene anonimizzato (vedi account-deletion.service.ts).
  deleteMyAccount(): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/user/me`);
  }
}
