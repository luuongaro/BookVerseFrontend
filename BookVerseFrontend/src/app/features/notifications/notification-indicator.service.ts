import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { API_URL } from '../../core/api/api.config';
import { ReadingGroupsService } from '../groups/services/reading-groups.service';

@Injectable({ providedIn: 'root' })
export class NotificationIndicatorService {
  private readonly http = inject(HttpClient);
  private readonly groups = inject(ReadingGroupsService);
  private readonly friendCount = signal(0);
  private readonly groupCount = signal(0);
  private friendRevision = 0;
  private groupRevision = 0;
  readonly hasPending = computed(() => this.friendCount() > 0 || this.groupCount() > 0);

  setFriends(count: number): void { this.friendRevision++; this.friendCount.set(count); }
  setGroups(count: number): void { this.groupRevision++; this.groupCount.set(count); }
  reset(): void { this.setFriends(0); this.setGroups(0); }

  refresh(userId: string) {
    const friendRevision = this.friendRevision;
    const groupRevision = this.groupRevision;
    const friends = this.http.get<unknown[]>(`${API_URL}/friendships/requests`).pipe(
      map(items => items.length), catchError(() => of(null)),
    );
    const invitations = this.http.get<unknown[]>(`${API_URL}/membership-invitations/me`).pipe(
      map(items => items.length), catchError(() => of(null)),
    );
    const requests = this.groups.getCreatedByUser(userId).pipe(
      switchMap(groups => groups.length ? forkJoin(groups.map(group =>
        this.http.get<unknown[]>(`${API_URL}/reading-groups/${group.idExternal}/membership-requests/pending`),
      )).pipe(map(items => items.reduce((total, group) => total + group.length, 0))) : of(0)),
      catchError(() => of(null)),
    );
    return forkJoin({ friends, invitations, requests }).pipe(tap(counts => {
      if (counts.friends !== null && this.friendRevision === friendRevision) this.setFriends(counts.friends);
      if (counts.invitations !== null && counts.requests !== null && this.groupRevision === groupRevision) this.setGroups(counts.invitations + counts.requests);
    }));
  }
}
