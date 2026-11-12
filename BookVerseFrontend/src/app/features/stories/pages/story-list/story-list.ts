import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryService } from '../../services/story.services';
import { StoryResponse } from '../../models/story-response';
import { PageResponse } from '../../models/page-response';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-story-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './story-list.html',
  styleUrl: './story-list.css',
})
export class StoryList implements OnInit {
  private readonly service = inject(StoryService);
  private readonly destroyRef = inject(DestroyRef);
  readonly result = signal<PageResponse<StoryResponse> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  titleFilter = '';
  authorFilter = '';
  genreFilter = '';
  friendsOnly = false;
  private applied = { title: '', author: '', genre: '', friendsOnly: false };
  search(): void { this.applied = { title: this.titleFilter.trim(), author: this.authorFilter.trim(), genre: this.genreFilter.trim(), friendsOnly: this.friendsOnly }; this.load(); }
  clear(): void { this.titleFilter = ''; this.authorFilter = ''; this.genreFilter = ''; this.friendsOnly = false; this.search(); }
  get hasFilters(): boolean { return !!(this.applied.title || this.applied.author || this.applied.genre || this.applied.friendsOnly); }
  private request?: Subscription;
  ngOnInit(): void {
    this.load();
  }
  load(page = 0): void {
    if (page < 0) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const { title, author, genre, friendsOnly } = this.applied;
    this.request = (this.hasFilters ? this.service.searchExplore(title, author, genre, friendsOnly, page) : this.service.getToExplore(page))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
}
