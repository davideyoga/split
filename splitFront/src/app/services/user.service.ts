import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root' // Questo lo rende disponibile ovunque
})

export class UserService {

  // Legge l'URL dal file environment
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient); // Inietta HttpClient

  getUsers(searchQuery: string): Observable<User[]> {
    // Query param e non path: HttpClient codifica `/`, `?`, `#` e `..` resta testo.
    return this.http.get<User[]>(`${this.baseUrl}/user`, { params: { q: searchQuery } }).pipe(
      // Gestiamo l'errore qui per non rompere il componente
      catchError((err) => {
        console.error('Errore durante la ricerca degli utenti', err);
        // In caso di errore, restituiamo un array vuoto come se nulla fosse successo
        return of([]);
      })
    );
  }

  /**
   * Cambia il nickname dell'utente loggato. Un errore arriva con
   * `error.code` = NICKNAME_* (regole di utils/nickname.ts, o NICKNAME_TAKEN).
   */
  updateMyNickname(nickName: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/user/me`, { nickName });
  }
}
