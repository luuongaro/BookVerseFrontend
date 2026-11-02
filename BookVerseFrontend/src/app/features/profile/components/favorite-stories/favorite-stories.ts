import { Component, DestroyRef, Input, OnChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserService } from '../../services/user.service';
import { UserProfileStory } from '../../models/user-profile.model';

@Component({
  selector: 'app-favorite-stories',
  imports: [RouterLink],
  templateUrl: './favorite-stories.html',
  styleUrl: './favorite-stories.css',
})
export class FavoriteStories implements OnChanges {
  private readonly users = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  @Input({ required: true }) userId = '';
  @Input() editable = false;
  readonly stories = signal<UserProfileStory[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly removing = signal<string | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  ngOnChanges(): void {
    this.stories.set([]);
    this.actionError.set('');
    this.load(0);
  }

  load(page = this.page()): void {
    if (!this.userId) return;
    this.request?.unsubscribe();
    this.page.set(Math.max(0, page));
    this.loading.set(true);
    this.error.set('');
    this.request = this.users
      .getFavoriteStories(this.userId, this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!result.content.length && result.number > 0) {
            this.load(result.number - 1);
            return;
          }
          this.stories.set(result.content);
          this.page.set(result.number);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No pudimos cargar las historias favoritas.');
          this.loading.set(false);
        },
      });
  }

  remove(story: UserProfileStory): void {
    if (!this.editable || this.removing()) return;
    const userId = this.userId;
    this.removing.set(story.idExternal);
    this.actionError.set('');
    this.users
      .removeFavoriteStory(story.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removing.set(null);
          if (userId === this.userId) this.load();
        },
        error: () => {
          this.removing.set(null);
          if (userId === this.userId)
            this.actionError.set('No pudimos quitar la historia de favoritas.');
        },
      });
  }
}
