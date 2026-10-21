import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
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
  private readonly url = 'http://localhost:8080/api/group-goals';

  getById(goalId: string): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(`${this.url}/${goalId}`);
  }

  getByGroup(groupId: string): Observable<GroupGoal[]> {
    return this.http.get<GroupGoal[]>(`${this.url}/group/${groupId}`);
  }

  getActiveByGroup(groupId: string): Observable<GroupGoal> {
    return this.http.get<GroupGoal>(
      `${this.url}/group/${groupId}/active`,
    );
  }

  create(
    groupId: string,
    request: CreateGroupGoalRequest,
  ): Observable<GroupGoal> {
    return this.http.post<GroupGoal>(
      `${this.url}/group/${groupId}`,
      request,
    );
  }

  changeStatus(
    goalId: string,
    request: ChangeGroupGoalStatusRequest,
  ): Observable<GroupGoal> {
    return this.http.patch<GroupGoal>(
      `${this.url}/${goalId}/status`,
      request,
    );
  }

  cancel(goalId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${goalId}`);
  }
}