import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

export interface CreateExpensePayload {
  description: string;
  amount: number;
  participantPublicIds: string[];
}

export interface ExpenseContribution {
  id: number;
  share: string;
  user: User;
}

export interface ExpenseListItem {
  id: number;
  description: string;
  amount: string;
  currency: string;
  createdDate: string;
  paidBy: User;
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

  create(payload: CreateExpensePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/expense`, payload);
  }
}
