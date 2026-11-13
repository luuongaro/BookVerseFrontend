import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../profile/services/user.service';
import { Login } from './login';

describe('Login transition', () => {
  const login = vi.fn();
  const getByIdExternal = vi.fn();
  const setCurrentUser = vi.fn();
  const clearCurrentUser = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    login.mockReset();
    getByIdExternal.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { login } },
      { provide: UserService, useValue: { getByIdExternal, setCurrentUser, clearCurrentUser } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => '/stories' } } } },
    ] });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  });

  it('waits for the animation after a successful login and preserves the return URL', () => {
    login.mockReturnValue(of({ token: 'test', userId: 'user' }));
    getByIdExternal.mockReturnValue(of({ idExternal: 'user' }));
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.loginForm.setValue({ email: 'reader@example.com', password: 'test' });
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.login-transition img')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(navigate).toHaveBeenCalledWith('/stories');
  });

  it('does not animate or navigate after an authentication error', () => {
    login.mockReturnValue(throwError(() => new Error('unauthorized')));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    fixture.componentInstance.loginForm.setValue({ email: 'reader@example.com', password: 'bad' });
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.entering()).toBe(false);
    expect(fixture.componentInstance.signingIn()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders the transition when the profile arrives asynchronously', async () => {
    vi.useRealTimers();
    const profile = new Subject<{ idExternal: string }>();
    login.mockReturnValue(of({ token: 'test', userId: 'user' }));
    getByIdExternal.mockReturnValue(profile);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    fixture.componentInstance.loginForm.setValue({ email: 'reader@example.com', password: 'test' });
    fixture.componentInstance.onSubmit();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.login-transition')).toBeNull();
    profile.next({ idExternal: 'user' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.login-transition img')).not.toBeNull();
    fixture.destroy();
  });
});
