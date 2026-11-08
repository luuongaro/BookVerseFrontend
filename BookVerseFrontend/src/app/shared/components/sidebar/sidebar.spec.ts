import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { UserService } from '../../../features/profile/services/user.service';
import { Sidebar } from './sidebar';

describe('Main navigation', () => {
  function setup(role = 'ROLE_USER') {
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ roles: [role] }))}.signature`);
    const users = {
      currentUser: signal({ idExternal: 'reader', username: 'Lu' }),
      loadCurrentUser: vi.fn(() => of({ idExternal: 'reader', username: 'Lu' })),
      getProfileAppearance: vi.fn(() => of({ configured: false })),
      getCachedProfileAppearance: vi.fn(() => undefined),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([]), { provide: UserService, useValue: users }],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    return { fixture, users, navigate };
  }
  afterEach(() => localStorage.clear());

  it('keeps profile access and logout available in both navigation layouts', () => {
    const { fixture, users, navigate } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.mobile-profile')?.getAttribute('href')).toBe('/profile');
    expect(el.querySelector('.sidebar-bottom a[href="/profile"]')).not.toBeNull();
    expect(el.querySelector('.mobile-profile')?.textContent).toContain('Mi perfil');
    expect(el.querySelector('.sidebar-nav')?.getAttribute('tabindex')).toBe('0');
    el.querySelector<HTMLButtonElement>('.mobile-logout')!.click();
    expect(users.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it.each([
    ['ROLE_USER', false, false],
    ['ROLE_MODERATOR', true, false],
    ['ROLE_ADMIN', true, true],
  ])('keeps navigation permissions for %s', (role, reports, roles) => {
    const { fixture } = setup(role);
    const el: HTMLElement = fixture.nativeElement;
    expect(!!el.querySelector('a[href="/reports"]')).toBe(reports);
    expect(!!el.querySelector('a[href="/role-management"]')).toBe(roles);
    expect(el.querySelector('a[href="/library"]')).not.toBeNull();
  });
});
