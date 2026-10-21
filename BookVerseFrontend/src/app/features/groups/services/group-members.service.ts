import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { GroupMember } from '../models/group-member.model';

export interface AddGroupMemberRequest {
  userId: string;
}

@Service()
export class GroupMembersService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:8080/api/group-members';

  getActiveByGroup(groupId: string): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(`${this.url}/group/${groupId}`);
  }

  getActiveByUser(userId: string): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(`${this.url}/user/${userId}`);
  }

  getById(idExternal: string): Observable<GroupMember> {
    return this.http.get<GroupMember>(`${this.url}/${idExternal}`);
  }

  addMember(
    groupId: string,
    request: AddGroupMemberRequest,
  ): Observable<GroupMember> {
    return this.http.post<GroupMember>(
      `${this.url}/group/${groupId}`,
      request,
    );
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/group/${groupId}/user/${userId}`,
    );
  }

  leaveGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/group/${groupId}/leave`);
  }
}