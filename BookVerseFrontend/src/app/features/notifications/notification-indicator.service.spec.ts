import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ReadingGroupsService } from '../groups/services/reading-groups.service';
import { NotificationIndicatorService } from './notification-indicator.service';

describe('Notification indicator', () => {
  it('shows pending requests and clears after all are answered', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ReadingGroupsService, useValue: { getCreatedByUser: () => of([{ idExternal: 'group' }]) } },
    ] });
    const service = TestBed.inject(NotificationIndicatorService);
    const http = TestBed.inject(HttpTestingController);
    service.refresh('user').subscribe();
    http.expectOne(req => req.url.endsWith('/friendships/requests')).flush([{ id: 'friend' }]);
    http.expectOne(req => req.url.endsWith('/membership-invitations/me')).flush([]);
    http.expectOne(req => req.url.endsWith('/reading-groups/group/membership-requests/pending')).flush([{ id: 'group-request' }]);
    expect(service.hasPending()).toBe(true);
    service.setFriends(0);
    expect(service.hasPending()).toBe(true);
    service.setGroups(0);
    expect(service.hasPending()).toBe(false);
    http.verify();
  });
  it('does not overwrite newer state with an older refresh response', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ReadingGroupsService, useValue: { getCreatedByUser: () => of([]) } },
    ] });
    const service = TestBed.inject(NotificationIndicatorService);
    const http = TestBed.inject(HttpTestingController);
    service.refresh('user').subscribe();
    service.setFriends(0);
    http.expectOne(req => req.url.endsWith('/friendships/requests')).flush([{ id: 'old' }]);
    http.expectOne(req => req.url.endsWith('/membership-invitations/me')).flush([]);
    expect(service.hasPending()).toBe(false);
    http.verify();
  });
});
