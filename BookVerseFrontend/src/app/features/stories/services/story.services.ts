import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../../../core/api/api.config';
import { StoryRequest } from '../models/story-request';
import { StoryResponse } from '../models/story-response';
import { StoryDetailResponse } from '../models/story-detail-response';
import { PageResponse } from '../models/page-response';

@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/stories`;
  getAll(page = 0) {
    return this.http.get<PageResponse<StoryResponse>>(this.url, { params: { page, size: 12 } });
  }
  getById(id: string) {
    return this.http.get<StoryDetailResponse>(`${this.url}/${encodeURIComponent(id)}`);
  }
  getByAuthor(authorId: string, page = 0) {
    return this.http.get<PageResponse<StoryResponse>>(
      `${this.url}/author/${encodeURIComponent(authorId)}`,
      { params: { page, size: 12 } },
    );
  }
  create(request: StoryRequest) {
    return this.http.post<StoryResponse>(this.url, request);
  }
  update(id: string, request: StoryRequest) {
    return this.http.put<StoryResponse>(`${this.url}/${encodeURIComponent(id)}`, request);
  }
  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
