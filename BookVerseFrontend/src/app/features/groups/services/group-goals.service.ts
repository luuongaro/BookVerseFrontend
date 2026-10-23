import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL, authHeaders } from '../../../core/api/api.config';
import { GroupGoal } from '../models/group-goal.model';

export interface CreateGroupGoalRequest {
  groupId: string;
  goalType: string;
  targetProgress: number;
  targetDate: string;
}

export interface ChangeGroupGoalStatusRequest {
  status: string;
}

@Service()
export class GroupGoalsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-goals`;

  getById(goalId: string): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(`${this.url}/${goalId}`, {
      headers: authHeaders(),
    });
  }

  getByGroup(groupId: string): Observable<GroupGoal[]> {
    return this.http.get<GroupGoal[]>(`${this.url}/group/${groupId}`, {
      headers: authHeaders(),
    });
  }

  getActiveByGroup(groupId: string): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(
      `${this.url}/group/${groupId}/active`,
      { headers: authHeaders() },
    );
  }

  create(
    groupId: string,
    request: CreateGroupGoalRequest,
  ): Observable<GroupGoal> {
    return this.http.post<GroupGoal>(
      `${this.url}/group/${groupId}`,
      request,
      { headers: authHeaders() },
    );
  }

  changeStatus(
    goalId: string,
    request: ChangeGroupGoalStatusRequest,
  ): Observable<GroupGoal> {
    return this.http.patch<GroupGoal>(
      `${this.url}/${goalId}/status`,
      request,
      { headers: authHeaders() },
    );
  }

  cancel(goalId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${goalId}`, {
      headers: authHeaders(),
    });
  }
}