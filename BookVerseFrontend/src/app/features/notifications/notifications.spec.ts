import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Notifications } from './notifications';
import { ReadingGroupsService } from '../groups/services/reading-groups.service';
import { UserService } from '../profile/services/user.service';

describe('Group notifications', () => {
  afterEach(() => localStorage.removeItem('userId'));
  it('loads invitations and join requests and accepts a request', () => {
    localStorage.setItem('userId', 'owner');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ReadingGroupsService, useValue: {
        getCreatedByUser: () => of([{ idExternal: 'group' }]),
        getById: () => of({ name: 'Lecturas' }),
      } },
      { provide: UserService, useValue: { getProfile: () => of({ username: 'Ana' }) } },
    ] });
    const fixture = TestBed.createComponent(Notifications);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url.endsWith('/friendships/requests')).flush([{ id: 'friend-request', userId: 'other', username: 'Lu', createdAt: '2026-01-01' }]);
    http.expectOne(req => req.url.endsWith('/membership-invitations/me')).flush([]);
    http.expectOne(req => req.url.endsWith('/reading-groups/group/membership-requests/pending')).flush([
      { idExternal: 'request', groupId: 'group', targetUserId: 'reader', type: 'JOIN_REQUEST', createdAt: '2026-01-01' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain('Lecturas');
    expect(fixture.nativeElement.textContent).toContain('Lu');
    fixture.componentInstance.respondFriend(fixture.componentInstance.friendRequests()[0], 'accept');
    http.expectOne(req => req.url.endsWith('/friendships/friend-request/accept') && req.method === 'POST').flush(null);
    expect(fixture.componentInstance.friendRequests()).toHaveLength(0);
    fixture.componentInstance.respond(fixture.componentInstance.notices()[0], 'accept');
    http.expectOne(req => req.url.endsWith('/membership-requests/request/accept') && req.method === 'POST').flush({});
    expect(fixture.componentInstance.notices()).toHaveLength(0);
    http.verify();
  });
});
