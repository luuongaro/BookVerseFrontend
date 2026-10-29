import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../../../core/api/api.config';
import { ChapterResponse } from '../models/chapter-response';
import { ChapterCreateRequest } from '../models/chapter-create-request';
import { ChapterUpdateRequest } from '../models/chapter-update-request';
import { PageResponse } from '../models/page-response';

@Injectable({ providedIn: 'root' })
export class ChapterService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/chapters`;
  getById(id: string) {
    return this.http.get<ChapterResponse>(`${this.url}/${encodeURIComponent(id)}`);
  }
  getByStory(storyId: string, page = 0, publishedOnly = false) {
    return this.http.get<PageResponse<ChapterResponse>>(
      `${this.url}/story/${encodeURIComponent(storyId)}`,
      { params: { page, size: 20, ...(publishedOnly ? { publishedOnly: true } : {}) } },
    );
  }
  create(request: ChapterCreateRequest) {
    return this.http.post<ChapterResponse>(this.url, request);
  }
  update(id: string, request: ChapterUpdateRequest) {
    return this.http.put<ChapterResponse>(`${this.url}/${encodeURIComponent(id)}`, request);
  }
  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
