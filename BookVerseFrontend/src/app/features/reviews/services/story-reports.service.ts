import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';
import {
  CreateStoryReport,
  StoryReport,
  StoryReportModeration,
} from '../models/story-report.model';

@Service()
export class StoryReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/story-reports`;

  getAll(): Observable<StoryReport[]> {
    return this.http.get<StoryReport[]>(this.url);
  }

  getPending(): Observable<StoryReport[]> {
    return this.http.get<StoryReport[]>(`${this.url}/pending`);
  }

  getById(reportId: string): Observable<StoryReport> {
    return this.http.get<StoryReport>(
      `${this.url}/${encodeURIComponent(reportId)}`,
    );
  }

  create(request: CreateStoryReport): Observable<StoryReport> {
    return this.http.post<StoryReport>(this.url, request);
  }

  approve(reportId: string, request: StoryReportModeration): Observable<StoryReport> {
    return this.http.patch<StoryReport>(
      `${this.url}/${encodeURIComponent(reportId)}/approve`,
      request,
    );
  }

  reject(reportId: string, request: StoryReportModeration): Observable<StoryReport> {
    return this.http.patch<StoryReport>(
      `${this.url}/${encodeURIComponent(reportId)}/reject`,
      request,
    );
  }
}
