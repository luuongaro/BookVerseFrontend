import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { API_URL } from '../../core/api/api.config';
import { ReadingGroupsService } from '../groups/services/reading-groups.service';
import { UserService } from '../profile/services/user.service';

interface MembershipRequest {
  idExternal: string; groupId: string; targetUserId: string; createdById: string;
  type: 'JOIN_REQUEST' | 'INVITATION'; createdAt: string;
}
interface Notice extends MembershipRequest { groupName: string; userName: string; }

@Component({
  selector: 'app-notifications', imports: [DatePipe],
  templateUrl: './notifications.html', styleUrl: './notifications.css',
})
export class Notifications implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly groups = inject(ReadingGroupsService);
  private readonly users = inject(UserService);
  readonly notices = signal<Notice[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.error.set('No encontramos tu sesión.'); this.loading.set(false); return; }
    this.loading.set(true); this.error.set('');
    const invitations = this.http.get<MembershipRequest[]>(`${API_URL}/membership-invitations/me`);
    const requests = this.groups.getCreatedByUser(userId).pipe(switchMap(groups =>
      groups.length ? forkJoin(groups.map(group => this.http.get<MembershipRequest[]>(`${API_URL}/reading-groups/${group.idExternal}/membership-requests/pending`))) : of([] as MembershipRequest[][])
    ), map(result => result.flat()));
    forkJoin([invitations, requests]).pipe(
      switchMap(([invitations, requests]) => {
        const all = [...invitations, ...requests];
        return all.length ? forkJoin(all.map(item => forkJoin({
          group: this.groups.getById(item.groupId).pipe(catchError(() => of(null))),
          user: this.users.getProfile(item.type === 'INVITATION' ? item.createdById : item.targetUserId).pipe(catchError(() => of(null))),
        }).pipe(map(({group, user}) => ({...item, groupName: group?.name ?? 'Grupo de lectura', userName: user?.username ?? 'Una persona'}))))) : of([] as Notice[]);
      }),
    ).subscribe({
      next: notices => { this.notices.set(notices.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))); this.loading.set(false); },
      error: () => { this.error.set('No pudimos cargar las notificaciones. Intentá de nuevo.'); this.loading.set(false); },
    });
  }

  respond(notice: Notice, action: 'accept' | 'reject'): void {
    if (this.busy()) return;
    this.busy.set(notice.idExternal); this.error.set('');
    this.http.post(`${API_URL}/membership-requests/${notice.idExternal}/${action}`, {}).subscribe({
      next: () => { this.notices.update(items => items.filter(item => item.idExternal !== notice.idExternal)); this.busy.set(''); },
      error: () => { this.error.set('No pudimos responder la solicitud. Intentá de nuevo.'); this.busy.set(''); },
    });
  }
}
