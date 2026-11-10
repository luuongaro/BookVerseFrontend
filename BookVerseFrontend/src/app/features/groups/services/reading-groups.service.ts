import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';
import {
  CreateGroupReadingCycleRequest,
  GroupReadingCycle,
  GroupReadingParticipant,
  CreateReadingGroupRequest,
  ReadingGroup,
  UpdateGroupReadingCycleBookReferenceRequest,
  UpdateReadingGroupRequest,
} from '../models/reading-group.model';

export interface DiscoveredGroup {
  idExternal: string;
  name: string;
  activeMembersCount: number;
  activeContentTitle: string | null;
  membershipState: 'NOT_MEMBER' | 'MEMBER' | 'JOIN_REQUEST_PENDING' | 'INVITATION_PENDING';
}

@Service()
export class ReadingGroupsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reading-groups`;

  discover(): Observable<DiscoveredGroup[]> {
    return this.http.get<DiscoveredGroup[]>(`${this.url}/discover`);
  }

  requestMembership(groupId: string): Observable<unknown> {
    return this.http.post(`${this.url}/${groupId}/membership-requests`, {});
  }

  getAll(): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(this.url);
  }

  getById(idExternal: string): Observable<ReadingGroup> {
    return this.http.get<ReadingGroup>(`${this.url}/${idExternal}`);
  }

  getByBook(bookId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/book/${bookId}`,
    );
  }

  getByStory(storyId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/story/${storyId}`,
    );
  }

  getCreatedByUser(userId: string): Observable<ReadingGroup[]> {
    return this.http.get<ReadingGroup[]>(
      `${this.url}/user/${userId}`,
    );
  }

  create(request: CreateReadingGroupRequest): Observable<ReadingGroup> {
    return this.http.post<ReadingGroup>(this.url, request);
  }

  update(
    idExternal: string,
    request: UpdateReadingGroupRequest,
  ): Observable<ReadingGroup> {
    return this.http.put<ReadingGroup>(
      `${this.url}/${idExternal}`,
      request,
    );
  }

  deactivate(idExternal: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${idExternal}`);
  }

  getCycles(groupId: string): Observable<GroupReadingCycle[]> {
    return this.http.get<GroupReadingCycle[]>(
      `${this.url}/${groupId}/cycles`,
    );
  }

  getActiveCycle(groupId: string): Observable<GroupReadingCycle> {
    return this.http.get<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles/active`,
    );
  }

  createCycle(
    groupId: string,
    request: CreateGroupReadingCycleRequest,
  ): Observable<GroupReadingCycle> {
    return this.http.post<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles`,
      request,
    );
  }

  updateCycleBookReference(
    groupId: string,
    cycleId: string,
    request: UpdateGroupReadingCycleBookReferenceRequest,
  ): Observable<GroupReadingCycle> {
    return this.http.put<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles/${cycleId}/book-reference`,
      request,
    );
  }

  startCycle(
    groupId: string,
    cycleId: string,
  ): Observable<GroupReadingCycle> {
    return this.http.patch<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles/${cycleId}/start`,
      {},
    );
  }

  completeCycle(
    groupId: string,
    cycleId: string,
  ): Observable<GroupReadingCycle> {
    return this.http.patch<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles/${cycleId}/complete`,
      {},
    );
  }

  cancelCycle(
    groupId: string,
    cycleId: string,
  ): Observable<GroupReadingCycle> {
    return this.http.patch<GroupReadingCycle>(
      `${this.url}/${groupId}/cycles/${cycleId}/cancel`,
      {},
    );
  }

  getCycleParticipants(
    groupId: string,
    cycleId: string,
  ): Observable<GroupReadingParticipant[]> {
    return this.http.get<GroupReadingParticipant[]>(
      `${this.url}/${groupId}/cycles/${cycleId}/participants`,
    );
  }

  joinCycle(
    groupId: string,
    cycleId: string,
  ): Observable<GroupReadingParticipant> {
    return this.http.post<GroupReadingParticipant>(
      `${this.url}/${groupId}/cycles/${cycleId}/participants/me`,
      null,
    );
  }

  leaveCycle(groupId: string, cycleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${groupId}/cycles/${cycleId}/participants/me`,
    );
  }
}
