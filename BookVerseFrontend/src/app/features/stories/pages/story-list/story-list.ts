import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryService } from '../../services/story.services';
import { StoryResponse } from '../../models/story-response';
import { PageResponse } from '../../models/page-response';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-story-list',
  imports: [RouterLink],
  templateUrl: './story-list.html',
  styleUrl: './story-list.css',
})
export class StoryList implements OnInit {
  private readonly service = inject(StoryService);
  private readonly destroyRef = inject(DestroyRef);
  readonly mine = input(false);
  readonly result = signal<PageResponse<StoryResponse> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private request?: Subscription;
  ngOnInit(): void {
    this.load();
  }
  load(page = 0): void {
    if (page < 0) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const userId = localStorage.getItem('userId');
    if (this.mine() && !userId) {
      this.error.set('Iniciá sesión para ver tus historias.');
      this.loading.set(false);
      return;
    }
    const request = this.mine()
      ? this.service.getByAuthor(userId!, page)
      : this.service.getAll(page);
    this.request = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
