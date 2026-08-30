import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { User } from '../models/user.model';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'split_auth';

interface StoredAuth {
  accessToken: string;
  user: User;
}

interface LoginResponse {
  accessToken: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  private stored: StoredAuth | null = this.readStorage();

  currentUser = signal<User | null>(this.stored?.user ?? null);

  login(email: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email }).pipe(
      tap((response) => {
        this.stored = { accessToken: response.accessToken, user: response.user };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored));
        this.currentUser.set(response.user);
      })
    );
  }

  logout(): void {
    this.stored = null;
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return this.stored?.accessToken ?? null;
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
