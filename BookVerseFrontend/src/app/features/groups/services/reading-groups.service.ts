import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL, authHeaders } from '../../../core/api/api.config';
import {
  CreateReadingGroupRequest,
  ReadingGroup,
  UpdateReadingGroupRequest,
} from '../models/reading-group.model';

@Service()
export class ReadingGroupsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reading-groups`;

  getAll(): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(this.url, {
      headers: authHeaders(),
    });
  }

  getById(idExternal: string): Observable<ReadingGroup> {
    return this.http.get<ReadingGroup>(`${this.url}/${idExternal}`, {
      headers: authHeaders(),
    });
  }

  getByBook(bookId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/book/${bookId}`,
      { headers: authHeaders() },
    );
  }

  getByStory(storyId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/story/${storyId}`,
      { headers: authHeaders() },
    );
  }

  getCreatedByUser(userId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/user/${userId}`,
      { headers: authHeaders() },
    );
  }

  create(request: CreateReadingGroupRequest): Observable<ReadingGroup> {
    return this.http.post<ReadingGroup>(this.url, request, {
      headers: authHeaders(),
    });
  }

  update(
    idExternal: string,
    request: UpdateReadingGroupRequest,
  ): Observable<ReadingGroup> {
    return this.http.put<ReadingGroup>(
      `${this.url}/${idExternal}`,
      request,
      { headers: authHeaders() },
    );
  }

  deactivate(idExternal: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${idExternal}`, {
      headers: authHeaders(),
    });
  }
}