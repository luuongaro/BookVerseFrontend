import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import {API_URL} from '../../../core/api/api.config';

import { ChapterResponse } from '../models/chapter-response';

@Service()
export class ChapterService {

  private readonly http = inject(HttpClient);

  private readonly url =  `${API_URL}/chapters`;

  getById(
    idExternal: string
  ): Observable<ChapterResponse> {

    return this.http.get<ChapterResponse>(
      `${this.url}/${idExternal}`
    );
  }

  getByStory(
    storyId: string
  ): Observable<{
    content: ChapterResponse[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  }> {

    return this.http.get<{
      content: ChapterResponse[];
      totalElements: number;
      totalPages: number;
      number: number;
      size: number;
    }>(
      `${this.url}/story/${storyId}`
    );
  }
}