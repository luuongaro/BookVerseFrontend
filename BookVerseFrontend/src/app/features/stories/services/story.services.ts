import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';

import { StoryRequest } from '../models/story-request';
import { StoryResponse } from '../models/story-response';
import { StoryDetailResponse } from '../models/story-detail-response';

export interface StoryPageResponse {
  content: StoryResponse[];
  totalElements: number;
}

@Service()
export class StoryService {

  private readonly http = inject(HttpClient);

  private readonly url = `${API_URL}/stories`;

  getAll(): Observable<StoryResponse[]> {
    return this.http.get<StoryResponse[]>(
      this.url
    );
  }

  getById(
    idExternal: string
  ): Observable<StoryDetailResponse> {
    return this.http.get<StoryDetailResponse>(
      `${this.url}/${idExternal}`
    );
  }

  getByAuthor(
    authorId: string
  ): Observable<StoryPageResponse> {
    return this.http.get<StoryPageResponse>(
      `${this.url}/author/${encodeURIComponent(authorId)}?page=0&size=1`,
    );
  }

  create(
    request: StoryRequest
  ): Observable<StoryResponse> {
    return this.http.post<StoryResponse>(
      this.url,
      request
    );
  }

  update(
    idExternal: string,
    request: StoryRequest
  ): Observable<StoryResponse> {
    return this.http.put<StoryResponse>(
      `${this.url}/${idExternal}`,
      request
    );
  }

  delete(
    idExternal: string
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${idExternal}`
    );
  }
}
