import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Settlement } from '../models/settlement.model';

// POST /api/settlement: chi registra deve essere `from` o `to`.
export interface CreateSettlementPayload {
  fromPublicId: string;
  toPublicId: string;
  amount: number;
  note?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettlementService {

  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  // Nessun catchError -> of([]): un rimborso che manca in silenzio falserebbe i
  // saldi, meglio che la pagina mostri l'errore.
  list(): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(`${this.baseUrl}/settlement`);
  }

  create(payload: CreateSettlementPayload): Observable<Settlement> {
    return this.http.post<Settlement>(`${this.baseUrl}/settlement`, payload);
  }

  // Permesso a chi ha dato o ricevuto il rimborso (403 altrimenti).
  remove(publicId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/settlement/${publicId}`);
  }
}
