import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';

import { ReadingStatusRequest } from '../models/reading-status-request';
import { ReadingStatusResponse } from '../models/reading-status-response';

@Service()
export class ReadingStatusService {

  private readonly http = inject(HttpClient);

  private readonly url =
    `${API_URL}/reading-statuses`;

  getByUser(
    userId: string
  ): Observable<ReadingStatusResponse[]> {

    return this.http.get<ReadingStatusResponse[]>(
      `${this.url}/user/${userId}`
    );
  }

  create(
    request: ReadingStatusRequest
  ): Observable<ReadingStatusResponse> {

    return this.http.post<ReadingStatusResponse>(
      this.url,
      request
    );
  }

  update(
    idExternal: string,
    request: ReadingStatusRequest
  ): Observable<ReadingStatusResponse> {

    return this.http.put<ReadingStatusResponse>(
      `${this.url}/${idExternal}`,
      request
    );
  }
}