import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';

export interface GroupCommentReport {
  reportId: string;
  commentId: string;
  groupId: string;
  groupName?: string | null;
  commentAuthorUsername: string | null;
  commentContent: string;
  reporterUsername: string | null;
  moderatorUsername: string | null;
  restoredByUserId: string | null;
  restoredByUsername: string | null;
  restoredAt: string | null;
  reason: string;
  details: string | null;
  resolutionComment: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  commentStatus: 'ACTIVE' | 'MODERATED' | 'DELETED';
  createdAt: string;
  resolvedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class GroupCommentReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-comment-reports`;
  create(commentId: string, reason: string, details: string | null) {
    return this.http.post<GroupCommentReport>(this.url, { commentId, reason, details });
  }
  getAll() { return this.http.get<GroupCommentReport[]>(this.url); }
  getById(reportId: string) {
    return this.http.get<GroupCommentReport>(
      `${this.url}/${encodeURIComponent(reportId)}`,
    );
  }
  moderate(reportId: string, action: 'approve' | 'reject', resolutionComment: string | null) {
    return this.http.patch<GroupCommentReport>(`${this.url}/${encodeURIComponent(reportId)}/${action}`, { resolutionComment });
  }
  restore(reportId: string): Observable<void> {
    return this.http.patch<void>(
      `${this.url}/${encodeURIComponent(reportId)}/restore`,
      {},
    );
  }
}
