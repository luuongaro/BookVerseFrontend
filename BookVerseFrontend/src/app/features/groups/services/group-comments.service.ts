import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL, authHeaders } from '../../../core/api/api.config';
import {
  CreateGroupCommentRequest,
  GroupComment,
} from '../models/group-comment.model';

@Service()
export class GroupCommentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-comments`;

  getVisibleByGroup(groupId: string): Observable<GroupComment[]> {
    return this.http.get<GroupComment[]>(`${this.url}/group/${groupId}`, {
      headers: authHeaders(),
    });
  }

  create(
    groupId: string,
    request: CreateGroupCommentRequest,
  ): Observable<GroupComment> {
    return this.http.post<GroupComment>(
      `${this.url}/group/${groupId}`,
      request,
      { headers: authHeaders() },
    );
  }
}