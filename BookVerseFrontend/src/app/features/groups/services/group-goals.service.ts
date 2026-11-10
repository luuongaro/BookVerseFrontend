import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';
import { GroupGoal } from '../models/group-goal.model';

export interface ChangeGroupGoalStatusRequest {
  status: string;
}

@Service()
export class GroupGoalsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reading-groups`;

  getById(goalId: string): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(`${this.url}/${goalId}`);
  }

  getByCycle(groupId: string, cycleId: string): Observable<GroupGoal[]> {
    return this.http.get<GroupGoal[]>(
      `${this.url}/${groupId}/cycles/${cycleId}/goals`,
    );
  }

  getActiveByCycle(
    groupId: string,
    cycleId: string,
  ): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(
      `${this.url}/${groupId}/cycles/${cycleId}/goals/active`,
    );
  }

  create(
    groupId: string,
    cycleId: string,
    request: {
      goalType: string;
      targetProgress: number;
      targetDate: string;
    },
  ): Observable<GroupGoal> {
    return this.http.post<GroupGoal>(
      `${this.url}/${groupId}/cycles/${cycleId}/goals`,
      request,
    );
  }

  changeStatus(
    groupId: string,
    cycleId: string,
    goalId: string,
    request: ChangeGroupGoalStatusRequest,
  ): Observable<GroupGoal> {
    return this.http.patch<GroupGoal>(
      `${this.url}/${groupId}/cycles/${cycleId}/goals/${goalId}/status`,
      request,
    );
  }

  cancel(
    groupId: string,
    cycleId: string,
    goalId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${groupId}/cycles/${cycleId}/goals/${goalId}`,
    );
  }
}
