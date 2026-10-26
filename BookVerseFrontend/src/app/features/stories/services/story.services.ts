import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import {
  API_URL,
  authHeaders
} from '../../../core/api/api.config';

import { StoryRequest } from '../models/story-request';
import { StoryResponse } from '../models/story-response';
import { StoryDetailResponse } from '../models/story-detail-response';

@Service()
export class StoryService {

  private readonly http = inject(HttpClient);

  private readonly url = `${API_URL}/stories`;

  getAll(): Observable<StoryResponse[]> {
    return this.http.get<StoryResponse[]>(
      this.url,
      {
        headers: authHeaders()
      }
    );
  }

  getById(
    idExternal: string
  ): Observable<StoryDetailResponse> {
    return this.http.get<StoryDetailResponse>(
      `${this.url}/${idExternal}`,
      {
        headers: authHeaders()
      }
    );
  }

  getByAuthor(
    authorId: string
  ): Observable<StoryResponse[]> {
    return this.http.get<StoryResponse[]>(
      `${this.url}/author/${authorId}`,
      {
        headers: authHeaders()
      }
    );
  }

  create(
    request: StoryRequest
  ): Observable<StoryResponse> {
    return this.http.post<StoryResponse>(
      this.url,
      request,
      {
        headers: authHeaders()
      }
    );
  }

  update(
    idExternal: string,
    request: StoryRequest
  ): Observable<StoryResponse> {
    return this.http.put<StoryResponse>(
      `${this.url}/${idExternal}`,
      request,
      {
        headers: authHeaders()
      }
    );
  }

  delete(
    idExternal: string
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${idExternal}`,
      {
        headers: authHeaders()
      }
    );
  }
}