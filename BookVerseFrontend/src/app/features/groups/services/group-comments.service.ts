import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateGroupCommentRequest,
  GroupComment,
} from '../models/group-comment.model';

@Service()
export class GroupCommentsService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:8080/api/group-comments';

  getVisibleByGroup(groupId: string): Observable<GroupComment[]> {
    return this.http.get<GroupComment[]>(`${this.url}/group/${groupId}`);
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
}