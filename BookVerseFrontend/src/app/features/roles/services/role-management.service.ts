import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';
import { ManagedRole, ManagedUser } from '../models/role-management.model';

@Service()
export class RoleManagementService {
  private readonly http = inject(HttpClient);

  getRoles(): Observable<ManagedRole[]> {
    return this.http.get<ManagedRole[]>(`${API_URL}/roles`);
  }

  getUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${API_URL}/users`);
  }

  replaceUserRoles(userId: string, roleIds: string[]): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(
      `${API_URL}/users/${encodeURIComponent(userId)}/roles`,
      { roleIds },
    );
  }
}
