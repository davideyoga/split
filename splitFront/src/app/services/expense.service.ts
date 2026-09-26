import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ExpenseCategory } from '../models/category.model';
import { User } from '../models/user.model';

export interface CreateExpensePayload {
  // Facoltativa: se omessa il backend salva '' (vedi fallback nelle liste).
  description?: string;
  amount: number;
  participantPublicIds: string[];
  // Chi ha pagato: se omesso il backend usa il creatore della spesa.
  paidByPublicId?: string;
  groupPublicId?: string;
  categoryPublicId?: string;
  // Divisione diseguale: una quota per contributore, somma = amount.
  // Omessa = divisione equa.
  shares?: ExpenseSharePayload[];
}

export interface ExpenseSharePayload {
  userPublicId: string;
  share: number;
}

// PATCH /api/expense/:publicId. Un campo omesso resta invariato; `null` su
// gruppo/categoria li toglie. La modale di modifica li manda sempre tutti.
export interface UpdateExpensePayload {
  description?: string;
  amount?: number;
  participantPublicIds?: string[];
  paidByPublicId?: string;
  groupPublicId?: string | null;
  categoryPublicId?: string | null;
  // `null` = torna alla divisione equa.
  shares?: ExpenseSharePayload[] | null;
}

export interface ExpenseContribution {
  id: number;
  share: string;
  user: User;
}

export interface ExpenseListItem {
  publicId: string;
  description: string;
  amount: string;
  currency: string;
  createdDate: string;
  // Il creatore resta sempre fra i contributori, anche dopo una modifica.
  createdBy: User;
  paidBy: User;
  group: { publicId: string; name: string } | null;
  category: ExpenseCategory | null;
  expenseContributions: ExpenseContribution[];
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  list(): Observable<ExpenseListItem[]> {
    return this.http.get<ExpenseListItem[]>(`${this.baseUrl}/expense`);
  }

  listByGroup(groupPublicId: string): Observable<ExpenseListItem[]> {
    return this.http.get<ExpenseListItem[]>(
      `${this.baseUrl}/expense/group/${groupPublicId}`,
    );
  }

  get(publicId: string): Observable<ExpenseListItem> {
    return this.http.get<ExpenseListItem>(`${this.baseUrl}/expense/${publicId}`);
  }

  create(payload: CreateExpensePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/expense`, payload);
  }

  // Modifica/eliminazione: permesse a qualsiasi contributore (403 altrimenti).
  update(publicId: string, payload: UpdateExpensePayload): Observable<ExpenseListItem> {
    return this.http.patch<ExpenseListItem>(`${this.baseUrl}/expense/${publicId}`, payload);
  }

  remove(publicId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/expense/${publicId}`);
  }
}
