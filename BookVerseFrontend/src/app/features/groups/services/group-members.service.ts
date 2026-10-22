import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL, authHeaders } from '../../../core/api/api.config';
import { GroupMember } from '../models/group-member.model';

interface AddGroupMemberRequest {
  userId: string;
}

@Service()
export class GroupMembersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-members`;

  getActiveByGroup(groupId: string): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(
      `${this.url}/group/${groupId}`,
      { headers: authHeaders() },
    );
  }

  getActiveByUser(userId: string): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(
      `${this.url}/user/${userId}`,
      { headers: authHeaders() },
    );
  }

  getById(idExternal: string): Observable<GroupMember> {
    return this.http.get<GroupMember>(
      `${this.url}/${idExternal}`,
      { headers: authHeaders() },
    );
  }

  addMember(
    groupId: string,
    request: AddGroupMemberRequest,
  ): Observable<GroupMember> {
    return this.http.post<GroupMember>(
      `${this.url}/group/${groupId}`,
      request,
      { headers: authHeaders() },
    );
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/group/${groupId}/user/${userId}`,
      { headers: authHeaders() },
    );
  }

  leaveGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/group/${groupId}/leave`,
      { headers: authHeaders() },
    );
  }
}