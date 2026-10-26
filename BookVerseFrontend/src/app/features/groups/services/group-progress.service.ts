import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/api/api.config';
import { GroupProgress } from '../models/group-progress.model';

@Service()
export class GroupProgressService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/group-progress`;

  getByGroup(groupId: string): Observable<GroupProgress> {
    return this.http.get<GroupProgress>(
      `${this.url}/group/${groupId}`,
    );
  }
}