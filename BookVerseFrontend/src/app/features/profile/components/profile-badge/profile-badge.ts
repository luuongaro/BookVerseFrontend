import { Component, DestroyRef, ElementRef, Input, OnChanges, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TokenService } from '../../../../core/services/token.service';
import { UserService } from '../../services/user.service';

export type BadgeId = 'FOUNDING_WRITER' | 'FOUNDING_PARTNERS' | 'FOUNDING_READER_1' | 'FOUNDING_READER_2' | 'FOUNDING_READER_3';
const BADGES: { id: BadgeId; name: string; image: string }[] = [
  { id: 'FOUNDING_WRITER', name: 'Escritor fundador', image: '/assets/badges/founding-writer.jpg' },
  { id: 'FOUNDING_PARTNERS', name: 'Socias fundadoras', image: '/assets/badges/founding-partners.jpg' },
  { id: 'FOUNDING_READER_1', name: 'Lector fundador · 1', image: '/assets/badges/founding-reader-1.jpg' },
  { id: 'FOUNDING_READER_2', name: 'Lector fundador · 2', image: '/assets/badges/founding-reader-2.jpg' },
  { id: 'FOUNDING_READER_3', name: 'Lector fundador · 3', image: '/assets/badges/founding-reader-3.png' },
];

@Component({ selector: 'app-profile-badge', templateUrl: './profile-badge.html', styleUrl: './profile-badge.css' })
export class ProfileBadge implements OnChanges {
  @Input({ required: true }) userId = '';
  @ViewChild('picker') picker?: ElementRef<HTMLDialogElement>;
  private readonly users = inject(UserService);
  private readonly token = inject(TokenService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly options = BADGES;
  readonly badge = signal<BadgeId | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly admin = this.token.hasAnyRole('ROLE_ADMIN');
  get selected() { return this.options.find(option => option.id === this.badge()) ?? null; }

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.badge.set(null);
    this.error.set('');
    if (!this.userId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.request = this.users.getProfileBadge(this.userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.badge.set(result.badge); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No pudimos cargar la insignia.'); },
    });
  }
  open(): void { if (this.admin && !this.loading()) { this.error.set(''); this.picker?.nativeElement.showModal(); } }
  close(): void { if (!this.saving()) this.picker?.nativeElement.close(); }
  setBadge(badge: BadgeId | null): void {
    if (!this.admin || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.users.updateProfileBadge(this.userId, badge).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.badge.set(result.badge); this.saving.set(false); this.picker?.nativeElement.close(); },
      error: () => { this.saving.set(false); this.error.set('No pudimos guardar la insignia. Intentá de nuevo.'); },
    });
  }
}
