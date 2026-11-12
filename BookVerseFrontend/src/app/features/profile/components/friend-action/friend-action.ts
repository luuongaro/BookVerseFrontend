import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../../core/api/api.config';

interface Relationship { id: string | null; state: 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS'; }
@Component({ selector: 'app-friend-action', templateUrl: './friend-action.html', styleUrl: './friend-action.css' })
export class FriendAction implements OnChanges {
  @Input({ required: true }) userId = '';
  private readonly http = inject(HttpClient);
  readonly relationship = signal<Relationship | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  ngOnChanges(): void { this.load(); }
  load(): void {
    const id = this.userId; if (!id) return;
    this.relationship.set(null); this.error.set('');
    this.http.get<Relationship>(`${API_URL}/friendships/users/${encodeURIComponent(id)}`).subscribe({
      next: value => { if (this.userId === id) this.relationship.set(value); },
      error: () => { if (this.userId === id) this.error.set('No pudimos cargar el estado de amistad.'); },
    });
  }
  send(): void {
    if (this.busy()) return;
    const id = this.userId; this.busy.set(true); this.error.set('');
    this.http.post<Relationship>(`${API_URL}/friendships/users/${encodeURIComponent(id)}`, {}).subscribe({
      next: value => { if (this.userId === id) this.relationship.set(value); this.busy.set(false); },
      error: () => { this.busy.set(false); if (this.userId === id) this.error.set('No pudimos enviar la solicitud. Intentá de nuevo.'); },
    });
  }
}
