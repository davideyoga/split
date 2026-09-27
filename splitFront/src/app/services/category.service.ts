import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Category } from '../models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  // Preconfigurate + proprie, non archiviate.
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/category`).pipe(
      catchError((err) => {
        console.error('Errore durante il caricamento delle categorie', err);
        return of([] as Category[]);
      }),
    );
  }

  createCategory(name: string, icon?: string): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/category`, {
      name,
      ...(icon ? { icon } : {}),
    });
  }

  renameCategory(publicId: string, name: string): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/category/${publicId}`, {
      name,
    });
  }

  // Cancellazione soft lato server: la categoria viene archiviata.
  archiveCategory(publicId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/category/${publicId}`);
  }
}
