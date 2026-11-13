import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';
import {
  CreateGroupCommentRequest,
  GroupComment,
  GroupCommentsVisibility,
} from '../models/group-comment.model';

@Service()
export class GroupCommentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-comments`;

  getVisibleByGroup(groupId: string): Observable<GroupCommentsVisibility> {
    return this.http.get<GroupCommentsVisibility>(
      `${this.url}/group/${groupId}`,
    );
  }

  create(
    groupId: string,
    request: CreateGroupCommentRequest,
  ): Observable<GroupComment> {
    return this.http.post<GroupComment>(
      `${this.url}/group/${groupId}`,
      request,
    );
  }

  delete(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${commentId}`);
  }
}
