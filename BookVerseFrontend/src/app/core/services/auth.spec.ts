import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { API_URL } from '../api/api.config';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenService, useValue: { getToken: () => 'test-session-token' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends login credentials to the authentication endpoint', () => {
    TestBed.inject(AuthService)
      .login({ email: 'reader@example.com', password: 'password' })
      .subscribe();
    const request = http.expectOne(`${API_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toEqual({ email: 'reader@example.com', password: 'password' });
    request.flush({ token: 'jwt', userId: 'user-id' });
  });

  it('registers against the configured API without sending the session token', () => {
    TestBed.inject(AuthService)
      .register({
        username: 'reader',
        email: 'reader@example.com',
        password: 'example-password',
      })
      .subscribe();
    const request = http.expectOne(`${API_URL}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ idExternal: 'reader' });
  });

  it('sends the session token to protected endpoints on the configured API', () => {
    TestBed.inject(HttpClient).get(`${API_URL}/users/profiles`).subscribe();
    const request = http.expectOne(`${API_URL}/users/profiles`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-session-token');
    request.flush([]);
  });

  it('does not send the session token to another origin or a matching path prefix', () => {
    for (const url of ['https://example.com/api/users', `${API_URL}.other/users`]) {
      TestBed.inject(HttpClient).get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush([]);
    }
  });
});
