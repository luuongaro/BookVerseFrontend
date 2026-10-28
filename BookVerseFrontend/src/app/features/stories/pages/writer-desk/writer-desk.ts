import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { apiError } from '../../../../core/api/api.config';
import { ChapterResponse } from '../../models/chapter-response';
import { PageResponse } from '../../models/page-response';
import { StoryResponse } from '../../models/story-response';
import { ChapterService } from '../../services/chapter.service';
import { StoryService } from '../../services/story.services';

@Component({
  selector: 'app-writer-desk',
  imports: [RouterLink],
  templateUrl: './writer-desk.html',
  styleUrl: './writer-desk.css',
})
export class WriterDesk implements OnInit {
  private readonly stories = inject(StoryService);
  private readonly chapters = inject(ChapterService);
  private readonly destroyRef = inject(DestroyRef);
  private storyRequest?: Subscription;
  private chapterRequest?: Subscription;
  readonly result = signal<PageResponse<StoryResponse> | null>(null);
  readonly selected = signal<StoryResponse | null>(null);
  readonly chapterResult = signal<PageResponse<ChapterResponse> | null>(null);
  readonly loading = signal(false);
  readonly loadingChapters = signal(false);
  readonly error = signal('');
  readonly chapterError = signal('');
  readonly storyPage = signal(0);
  readonly chapterPage = signal(0);

  ngOnInit(): void {
    this.loadStories();
  }

  loadStories(page = 0): void {
    if (page < 0) return;
    this.storyRequest?.unsubscribe();
    this.chapterRequest?.unsubscribe();
    this.storyPage.set(page);
    this.loading.set(true);
    this.loadingChapters.set(false);
    this.error.set('');
    this.chapterError.set('');
    this.result.set(null);
    this.selected.set(null);
    this.chapterResult.set(null);
    const userId = localStorage.getItem('userId');
    if (!userId) {
      this.loading.set(false);
      this.error.set('Volvé a iniciar sesión para ver tus historias.');
      return;
    }
    this.storyRequest = this.stories
      .getByAuthor(userId, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (result.content.some((story) => story.authorId !== userId)) {
            this.error.set('No pudimos cargar tus historias. Intentá nuevamente.');
            return;
          }
          this.result.set(result);
          if (result.content[0]) this.selectStory(result.content[0]);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(apiError(error));
        },
      });
  }

  selectStory(story: StoryResponse): void {
    const ownedStory = this.result()?.content.find((item) => item.idExternal === story.idExternal);
    if (!ownedStory) return;
    if (this.selected()?.idExternal === story.idExternal) return;
    this.selected.set(ownedStory);
    this.loadChapters();
  }

  loadChapters(page = 0): void {
    const story = this.selected();
    if (!story || page < 0) return;
    this.chapterRequest?.unsubscribe();
    this.chapterPage.set(page);
    this.chapterResult.set(null);
    this.loadingChapters.set(true);
    this.chapterError.set('');
    this.chapterRequest = this.chapters
      .getByStory(story.idExternal, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loadingChapters.set(false);
          if (result.content.some((chapter) => chapter.storyId !== story.idExternal)) {
            this.chapterError.set('No pudimos cargar los capítulos de esta historia.');
            return;
          }
          this.chapterResult.set(result);
        },
        error: (error) => {
          this.loadingChapters.set(false);
          this.chapterError.set(apiError(error));
        },
      });
  }
}
