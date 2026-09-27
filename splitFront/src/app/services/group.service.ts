import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Group } from '../models/group.model';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  getMyGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.baseUrl}/group`).pipe(
      catchError((err) => {
        console.error('Errore durante il caricamento dei gruppi', err);
        return of([] as Group[]);
      }),
    );
  }

  getGroup(publicId: string): Observable<Group> {
    return this.http.get<Group>(`${this.baseUrl}/group/${publicId}`);
  }

  createGroup(name: string, memberPublicIds: string[]): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/group`, {
      name,
      memberPublicIds,
    });
  }

  renameGroup(publicId: string, name: string): Observable<Group> {
    return this.http.patch<Group>(`${this.baseUrl}/group/${publicId}`, { name });
  }

  addMembers(publicId: string, memberPublicIds: string[]): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/group/${publicId}/members`, {
      memberPublicIds,
    });
  }

  removeMember(publicId: string, userPublicId: string): Observable<unknown> {
    return this.http.delete(
      `${this.baseUrl}/group/${publicId}/members/${userPublicId}`,
    );
  }
}
