import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, authHeaders } from '../../../core/api/api.config';
import {
  CreateReviewReport,
  ReviewReport,
  ReviewReportModeration,
} from '../models/review-report.model';

@Service()
export class ReviewReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/review-reports`;

  getAll(): Observable<ReviewReport[]> {
    return this.http.get<ReviewReport[]>(this.url, { headers: authHeaders() });
  }

  getPending(): Observable<ReviewReport[]> {
    return this.http.get<ReviewReport[]>(`${this.url}/pending`, { headers: authHeaders() });
  }

  getById(reportId: string): Observable<ReviewReport> {
    return this.http.get<ReviewReport>(`${this.url}/${encodeURIComponent(reportId)}`, {
      headers: authHeaders(),
    });
  }

  create(request: CreateReviewReport): Observable<ReviewReport> {
    return this.http.post<ReviewReport>(this.url, request, { headers: authHeaders() });
  }

  approve(reportId: string, request: ReviewReportModeration): Observable<ReviewReport> {
    return this.http.patch<ReviewReport>(
      `${this.url}/${encodeURIComponent(reportId)}/approve`,
      request,
      { headers: authHeaders() },
    );
  }

  reject(reportId: string, request: ReviewReportModeration): Observable<ReviewReport> {
    return this.http.patch<ReviewReport>(
      `${this.url}/${encodeURIComponent(reportId)}/reject`,
      request,
      { headers: authHeaders() },
    );
  }
}
