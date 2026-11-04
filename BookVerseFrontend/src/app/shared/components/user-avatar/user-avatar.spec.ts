import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserAvatar } from './user-avatar';
import { UserService } from '../../../features/profile/services/user.service';
import { PROFILE_AVATARS } from '../../../features/profile/models/profile-avatars';
import { API_URL } from '../../../core/api/api.config';

describe('Shared user avatars and appearance cache', () => {
  const url = `${API_URL}/users/profiles/reader/appearance`;
  const appearance = (avatarIndex = 2) => ({ coverIndex: 0, avatarIndex, configured: true });
  let http: HttpTestingController;
  let users: UserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    users = TestBed.inject(UserService);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function avatar(id: string | null = 'reader') {
    const fixture = TestBed.createComponent(UserAvatar);
    fixture.componentRef.setInput('userId', id);
    fixture.componentRef.setInput('username', 'Alex Lane');
    fixture.detectChanges();
    return fixture;
  }

  it('shares one appearance request and the same selected image across repeated users', () => {
    const first = avatar();
    const second = avatar();
    http.expectOne(url).flush(appearance());
    first.detectChanges();
    second.detectChanges();
    for (const fixture of [first, second]) {
      expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
        PROFILE_AVATARS[2].src,
      );
      expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
    }
    const later = avatar();
    http.expectNone(url);
    expect(later.nativeElement.querySelector('img').getAttribute('src')).toBe(
      PROFILE_AVATARS[2].src,
    );
  });

  it.each([-1, PROFILE_AVATARS.length, 1.5, NaN, null, undefined])(
    'uses initials for an invalid saved index: %s',
    (index) => {
      const fixture = avatar();
      http.expectOne(url).flush({ ...appearance(), avatarIndex: index });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('img')).toBeNull();
      expect(fixture.nativeElement.textContent.trim()).toBe('AL');
    },
  );

  it('uses initials when no appearance has been configured or no user is available', () => {
    const fixture = avatar();
    http.expectOne(url).flush({ ...appearance(0), configured: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('AL');
    const missing = avatar(null);
    expect(missing.nativeElement.querySelector('img')).toBeNull();
    http.expectNone((request) => request.url.endsWith('/appearance'));
  });

  it('removes a failed image and retries a new selection with the correct accessible name', () => {
    const fixture = avatar();
    fixture.componentRef.setInput('decorative', false);
    http.expectOne(url).flush(appearance());
    fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('AL');
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Avatar de Alex Lane');
    fixture.componentRef.setInput('avatarIndex', 4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      PROFILE_AVATARS[4].src,
    );
  });

  it('does not create an image with a blank URL', () => {
    const entry = PROFILE_AVATARS[0] as { src: string };
    const original = entry.src;
    try {
      entry.src = '  ';
      const fixture = avatar();
      http.expectOne(url).flush(appearance(0));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('img')).toBeNull();
      expect(fixture.nativeElement.textContent.trim()).toBe('AL');
    } finally {
      entry.src = original;
    }
  });

  it('reuses a failed lookup until explicitly retried and refreshes existing avatars on success', () => {
    const first = avatar();
    http.expectOne(url).flush({}, { status: 500, statusText: 'Unavailable' });
    const second = avatar();
    http.expectNone(url);
    expect(second.nativeElement.querySelector('img')).toBeNull();
    users.getProfileAppearance('reader', true).subscribe();
    http.expectOne(url).flush(appearance(5));
    for (const fixture of [first, second]) {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
        PROFILE_AVATARS[5].src,
      );
    }
  });

  it('updates all rendered avatars after saving and ignores an older pending GET', () => {
    localStorage.setItem('userId', 'reader');
    const first = avatar();
    const second = avatar();
    const old = http.expectOne(url);
    users.updateProfileAvatar(3).subscribe();
    const save = http.expectOne(`${API_URL}/users/profiles/me/appearance`);
    expect(save.request.body).toEqual({ avatarIndex: 3 });
    save.flush(appearance(3));
    old.flush(appearance(0));
    for (const fixture of [first, second]) {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
        PROFILE_AVATARS[3].src,
      );
    }
    users.getProfileAppearance('reader').subscribe((result) => expect(result.avatarIndex).toBe(3));
    http.expectNone(url);
  });

  it('clears cached appearance when the session ends', () => {
    avatar();
    http.expectOne(url).flush(appearance());
    users.logout();
    expect(users.getCachedProfileAppearance('reader')).toBeUndefined();
    users.getProfileAppearance('reader').subscribe();
    http.expectOne(url).flush(appearance(4));
  });

  it('uses the signed-in account in navigation and supports the first saved avatar', () => {
    users.setCurrentUser({
      idExternal: 'reader',
      username: 'Alex Lane',
      email: 'reader@example.test',
      status: 'ACTIVE',
    });
    const fixture = TestBed.createComponent(UserAvatar);
    fixture.detectChanges();
    http.expectOne(url).flush(appearance(0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      PROFILE_AVATARS[0].src,
    );
  });

  it('does not keep another person’s image while a changed user is loading', () => {
    const fixture = avatar();
    http.expectOne(url).flush(appearance(2));
    fixture.detectChanges();
    fixture.componentRef.setInput('userId', 'another-reader');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    http.expectOne(`${API_URL}/users/profiles/another-reader/appearance`).flush(appearance(4));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      PROFILE_AVATARS[4].src,
    );
  });

  it.each(['another-reader', 'reader'])(
    'ignores a late save after a new session starts as %s',
    (nextUser) => {
      localStorage.setItem('userId', 'reader');
      users.updateProfileAvatar(3).subscribe();
      const oldSave = http.expectOne(`${API_URL}/users/profiles/me/appearance`);
      users.logout();
      localStorage.setItem('userId', nextUser);
      users.setCurrentUser({
        idExternal: nextUser,
        username: 'Reader',
        email: 'reader@example.test',
        status: 'ACTIVE',
      });
      oldSave.flush(appearance(3));
      expect(users.getCachedProfileAppearance(nextUser)).toBeUndefined();
      expect(users.getCachedProfileAppearance('reader')).toBeUndefined();
    },
  );
});
