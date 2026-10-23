import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RoleManagementService } from './role-management.service';

describe('RoleManagementService API contract', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    localStorage.setItem('token', 'admin-token');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads roles and users with the authenticated administrator token', () => {
    const service = TestBed.inject(RoleManagementService);
    service.getRoles().subscribe();
    service.getUsers().subscribe();
    for (const url of ['http://localhost:8080/api/roles', 'http://localhost:8080/api/users']) {
      const request = http.expectOne(url);
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
      request.flush([]);
    }
  });

  it('replaces a user role set using the admin endpoint DTO', () => {
    const roleIds = ['role-user-id', 'role-moderator-id'];
    TestBed.inject(RoleManagementService).replaceUserRoles('user-id', roleIds).subscribe();
    const request = http.expectOne('http://localhost:8080/api/users/user-id/roles');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ roleIds });
    request.flush({ idExternal: 'user-id', roles: ['ROLE_USER', 'ROLE_MODERATOR'] });
  });
});
