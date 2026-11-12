import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { FriendList } from './friend-list';
import { UserService } from '../../services/user.service';

describe('Friends list', () => {
  it('shows friends with their selected avatars and profile links', () => {
    const users = {
      getCachedProfileAppearance: () => ({ configured: true, avatarIndex: 2 }),
      getProfileAppearance: () => of({ configured: true, avatarIndex: 2 }),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: UserService, useValue: users }] });
    const fixture = TestBed.createComponent(FriendList);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/friendships/me')).flush([{ id: 'friendship', userId: 'reader', username: 'Luna' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Luna');
    expect(fixture.nativeElement.querySelector('app-user-avatar img')?.getAttribute('src')).toContain('/avatars/romance.png');
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/users/reader');
    TestBed.inject(HttpTestingController).verify();
  });
});
