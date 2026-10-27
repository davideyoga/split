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
   * mostrato come "nessun utente" farebbe credere che l'amico non esista.
   */
  getUsers(searchQuery: string): Observable<User[]> {
    // Query param e non path: HttpClient codifica `/`, `?`, `#` e `..` resta testo.
    return this.http.get<User[]>(`${this.baseUrl}/user`, { params: { q: searchQuery } });
  }

  /**
   * Cambia il nickname dell'utente loggato. Un errore arriva con
   * `error.code` = NICKNAME_* (regole di utils/nickname.ts, o NICKNAME_TAKEN).
   */
  updateMyNickname(nickName: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/user/me`, { nickName });
  }
}
