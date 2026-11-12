import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { API_URL } from '../../../../core/api/api.config';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';

interface Friend { id: string; userId: string; username: string; }
@Component({ selector: 'app-friend-list', imports: [RouterLink, UserAvatar], templateUrl: './friend-list.html', styleUrl: './friend-list.css' })
export class FriendList implements OnInit {
  private readonly http = inject(HttpClient);
  readonly friends = signal<Friend[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.http.get<Friend[]>(`${API_URL}/friendships/me`).subscribe({
      next: friends => { this.friends.set(friends); this.loading.set(false); },
      error: () => { this.error.set('No pudimos cargar tus amigos.'); this.loading.set(false); },
    });
  }
}
