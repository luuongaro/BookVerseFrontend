import { Location } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../../app.routes';
import { API_URL } from '../../../../core/api/api.config';
import { TokenService } from '../../../../core/services/token.service';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { UserService } from '../../../profile/services/user.service';
import { PasswordRecovery } from './password-recovery';

const resetToken = 't'.repeat(43);
const validPassword = 'Updated123!';
const existingSession = `header.${btoa(JSON.stringify({ exp: 4102444800 }))}.signature`;

describe('Password recovery', () => {
  let http: HttpTestingController;
  let clearCurrentUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    clearCurrentUser = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: UserService, useValue: { clearCurrentUser } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  async function open(path = '/forgot-password') {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(path, PasswordRecovery);
    return { harness, page };
  }
  async function openReset() {
    return open(`/reset-password#token=${resetToken}`);
  }

  it('allows anonymous access through the real routes and validates the email', async () => {
    const { harness, page } = await open();
    page.emailForm.controls.email.setValue('invalid');
    page.requestLink();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Ingresá un correo válido.');
    http.expectNone(`${API_URL}/auth/forgot-password`);
  });

  it('requests one link, trims the email and always shows a generic confirmation', async () => {
    const { harness, page } = await open();
    localStorage.setItem('token', existingSession);
    expect(TestBed.inject(TokenService).getToken()).toBe(existingSession);
    page.emailForm.controls.email.setValue(' reader@example.com ');
    page.requestLink();
    page.requestLink();
    expect(page.submitting()).toBe(true);
    const request = http.expectOne(`${API_URL}/auth/forgot-password`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'reader@example.com' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 202, statusText: 'Accepted' });
    harness.detectChanges();
    expect(page.completed()).toBe(true);
    expect(harness.routeNativeElement!.textContent).toContain('Si hay una cuenta con ese correo');
    page.requestLink();
    http.expectNone(`${API_URL}/auth/forgot-password`);
    page.retryEmail();
    expect(page.completed()).toBe(false);
  });

  it('allows retrying a failed request without claiming that a message was sent', async () => {
    const { page } = await open();
    page.emailForm.controls.email.setValue('reader@example.com');
    page.requestLink();
    http
      .expectOne(`${API_URL}/auth/forgot-password`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(page.submitting()).toBe(false);
    expect(page.completed()).toBe(false);
    expect(page.error()).toContain('No pudimos enviar la solicitud');
    page.requestLink();
    http.expectOne(`${API_URL}/auth/forgot-password`).flush(null);
    expect(page.completed()).toBe(true);
  });

  it.each(['/reset-password', '/reset-password#token=invalid'])(
    'shows a request-new-link action for an invalid URL: %s',
    async (path) => {
      const { harness, page } = await open(path);
      expect(page.invalidLink()).toBe(true);
      expect(harness.routeNativeElement!.querySelector('input')).toBeNull();
      expect(
        harness.routeNativeElement!.querySelector('a[href="/forgot-password"]'),
      ).not.toBeNull();
      page.resetPassword();
      http.expectNone(`${API_URL}/auth/reset-password`);
    },
  );

  it('keeps the token out of the address bar and storage and checks confirmation', async () => {
    const { page } = await openReset();
    expect(TestBed.inject(Location).path(true)).not.toContain(resetToken);
    expect(localStorage.getItem('token')).toBeNull();
    page.passwordForm.setValue({ password: validPassword, confirmation: 'Different123!' });
    page.resetPassword();
    expect(page.passwordForm.hasError('passwordMismatch')).toBe(true);
    http.expectNone(`${API_URL}/auth/reset-password`);
  });

  it('changes the password once, clears the old session and requires a normal login', async () => {
    const { page, harness } = await openReset();
    localStorage.setItem('token', existingSession);
    localStorage.setItem('userId', 'existing-user');
    page.passwordForm.setValue({ password: validPassword, confirmation: validPassword });
    page.resetPassword();
    page.resetPassword();
    const request = http.expectOne(`${API_URL}/auth/reset-password`);
    expect(request.request.body).toEqual({ token: resetToken, password: validPassword });
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });
    harness.detectChanges();
    expect(page.completed()).toBe(true);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(clearCurrentUser).toHaveBeenCalledOnce();
    expect(page.passwordForm.controls.password.value).toBe('');
    expect(harness.routeNativeElement!.textContent).toContain('Contraseña actualizada');
    expect(harness.routeNativeElement!.querySelector('a.button[href="/login"]')).not.toBeNull();
    expect(TestBed.inject(Location).path()).toBe('/reset-password');
    page.resetPassword();
    http.expectNone(`${API_URL}/auth/reset-password`);
  });

  it.each(['weak', 'MissingNumber!', 'A1!' + 'a'.repeat(70), 'A1!' + 'é'.repeat(36)])(
    'rejects unsupported passwords before calling the API: %s',
    async (password) => {
      const { page } = await openReset();
      page.passwordForm.setValue({ password, confirmation: password });
      page.resetPassword();
      expect(page.passwordForm.invalid).toBe(true);
      http.expectNone(`${API_URL}/auth/reset-password`);
    },
  );

  it('handles an expired or used link without leaving the password in the form', async () => {
    const { page, harness } = await openReset();
    page.passwordForm.setValue({ password: validPassword, confirmation: validPassword });
    page.resetPassword();
    http.expectOne(`${API_URL}/auth/reset-password`).flush({}, { status: 410, statusText: 'Gone' });
    harness.detectChanges();
    expect(page.invalidLink()).toBe(true);
    expect(page.passwordForm.controls.password.value).toBe('');
    expect(harness.routeNativeElement!.textContent).toContain('El enlace venció o ya no es válido');
    expect(harness.routeNativeElement!.querySelector('input')).toBeNull();
  });

  it('preserves a valid link for retrying a temporary server error', async () => {
    const { page } = await openReset();
    page.passwordForm.setValue({ password: validPassword, confirmation: validPassword });
    page.resetPassword();
    http
      .expectOne(`${API_URL}/auth/reset-password`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(page.invalidLink()).toBe(false);
    expect(page.submitting()).toBe(false);
    page.resetPassword();
    const retry = http.expectOne(`${API_URL}/auth/reset-password`);
    expect(retry.request.body.token).toBe(resetToken);
    retry.flush(null);
  });

  it('cancels a pending request when leaving the page', async () => {
    const { page, harness } = await open();
    page.emailForm.controls.email.setValue('reader@example.com');
    page.requestLink();
    const request = http.expectOne(`${API_URL}/auth/forgot-password`);
    await harness.navigateByUrl('/login');
    expect(request.cancelled).toBe(true);
  });
});
