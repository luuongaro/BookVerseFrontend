import { CommonModule } from '@angular/common';

import {Component,computed,DestroyRef,inject,OnInit,signal} from '@angular/core';

import {
  ActivatedRoute,
  RouterModule
} from '@angular/router';

import { finalize, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiError } from '../../../../core/api/api.config';



import { ChapterResponse } from '../../models/chapter-response';
import { ChapterService } from '../../services/chapter.service';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { StoryService } from '../../services/story.services';

import { UserService } from '../../../profile/services/user.service';

import { ReadingStatusRequest } from '../../models/reading-status-request';
import { ReadingStatusResponse } from '../../models/reading-status-response';
import { ReadingStatusService } from '../../services/reading-status.service';

@Component({
  selector: 'app-chapter-reader',
  standalone: true,
  imports: [CommonModule,RouterModule],
  templateUrl: './chapter-reader.html',
  styleUrl: './chapter-reader.css'
})
export class ChapterReader implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private chapterRequest?: Subscription;
  private storyRequest?: Subscription;

  private readonly chapterService = inject(ChapterService);

  private readonly storyService = inject(StoryService);  

  private readonly readingStatusService = inject(ReadingStatusService);

  private readonly userService = inject(UserService);

  readonly storyId =  signal<string | null>(null);

  readonly chapterId = signal<string | null>(null);

  readonly chapter = signal<ChapterResponse | null>(null);

  readonly isLoading = signal(false);

  readonly errorMessage = signal<string | null>(null);

  readonly bookmarked = signal(false);

  readonly story = signal<StoryDetailResponse | null>(null);

  readonly readingStatus =
  signal<ReadingStatusResponse | null>(null);

  readonly isSavingProgress = signal(false);

  readonly progressMessage = signal<string | null>(null);

  readonly progressError = signal<string | null>(null);

  readonly previousChapter = computed(() => {

  const currentStory = this.story();
  const currentChapter = this.chapter();

  if (!currentStory || !currentChapter) {
    return null;
  }

  const currentIndex =
    currentStory.chapters.findIndex(
      chapter =>
        chapter.idExternal ===
        currentChapter.idExternal
    );

  if (currentIndex <= 0) {
    return null;
  }

  return currentStory.chapters[
    currentIndex - 1
  ];
});

readonly nextChapter = computed(() => {

  const currentStory = this.story();
  const currentChapter = this.chapter();

  if (!currentStory || !currentChapter) {
    return null;
  }

  const currentIndex =
    currentStory.chapters.findIndex(
      chapter =>
        chapter.idExternal ===
        currentChapter.idExternal
    );

  if (
    currentIndex === -1 ||
    currentIndex >=
      currentStory.chapters.length - 1
  ) {
    return null;
  }

  return currentStory.chapters[
    currentIndex + 1
  ];
});

ngOnInit(): void {

this.userService.loadCurrentUser().subscribe({
  error: () => {
    this.progressError.set(
      'No pudimos identificar tu progreso de lectura.'
    );
  }
});
  this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
    this.chapterRequest?.unsubscribe();
    this.storyRequest?.unsubscribe();
    this.story.set(null);
    this.chapter.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(false);

    const storyId =
      params.get('id');

    const chapterId =
      params.get('chapterId');

    this.storyId.set(storyId);
    this.chapterId.set(chapterId);

    if (!storyId || !chapterId) {

      this.errorMessage.set(
        'No pudimos identificar el capítulo.'
      );

      return;
    }

    this.loadStory(storyId);
    this.loadChapter(chapterId);

  });
}

  retry(): void {
    const storyId = this.storyId();
    const chapterId = this.chapterId();
    if (storyId && chapterId) { this.loadStory(storyId); this.loadChapter(chapterId); }
  }

  private loadChapter(chapterId: string): void {
    const storyId = this.storyId();
    this.chapterRequest?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.chapter.set(null);
    this.chapterRequest = this.chapterService.getById(chapterId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: chapter => {
          this.isLoading.set(false);
          if (chapter.storyId !== storyId) {
            this.errorMessage.set('El capítulo no pertenece a esta historia.');
            return;
          }
          this.chapter.set(chapter);
          this.registerReadingProgress(chapter);
        },
        error: error => {
          this.isLoading.set(false);
          this.errorMessage.set(apiError(error));
        }
      });
  }

  private loadStory(storyId: string): void {
    this.storyRequest?.unsubscribe();
    this.storyRequest = this.storyService.getById(storyId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: story => { this.story.set(story); },
        error: error => { this.errorMessage.set(apiError(error)); }
      });
  }

  toggleBookmark(): void {
    this.bookmarked.update(
      current => !current
    );
  }

private registerReadingProgress(
  chapter: ChapterResponse
): void {

  const currentStoryId =
    this.storyId();

  const currentUser =
    this.userService.currentUser();

  if (!currentStoryId || !currentUser) {
    return;
  }

  const userId =
    currentUser.idExternal;

  if (!userId) {
    this.progressError.set(
      'No pudimos identificar al usuario actual.'
    );

    return;
  }

  this.isSavingProgress.set(true);
  this.progressError.set(null);
  this.progressMessage.set(null);

  this.readingStatusService
    .getByUser(userId)
    .subscribe({

      next: statuses => {

        const existingStatus =
          statuses.find(
            status =>
              status.storyId === currentStoryId
          );

        this.saveReadingProgress(
          chapter,
          existingStatus ?? null
        );
      },

      error: () => {
        this.isSavingProgress.set(false);

        this.progressError.set(
          'El capítulo cargó, pero no pudimos consultar tu progreso.'
        );
      }

    });
}

private saveReadingProgress(
  chapter: ChapterResponse,
  existingStatus: ReadingStatusResponse | null
): void {

  const currentStoryId =
    this.storyId();

  if (!currentStoryId) {
    this.isSavingProgress.set(false);
    return;
  }

  if (existingStatus?.status === 'COMPLETED') {
    this.readingStatus.set(existingStatus);
    this.isSavingProgress.set(false);

    this.progressMessage.set(
      'Esta historia ya figura como completada.'
    );

    return;
  }

  const previousProgress =
    existingStatus?.progressType === 'CHAPTER'
      ? existingStatus.progressValue ?? 0
      : 0;

  const progressValue =
    Math.max(
      previousProgress,
      chapter.chapterNumber
    );

  const request: ReadingStatusRequest = {
    bookId: null,
    storyId: currentStoryId,
    status: 'IN_PROGRESS',
    startedAt:
      existingStatus?.startedAt
        ?? this.currentLocalDateTime(),
    finishedAt: null,
    progressType: 'CHAPTER',
    progressValue
  };

  const operation$ =
    existingStatus
      ? this.readingStatusService.update(
          existingStatus.idExternal,
          request
        )
      : this.readingStatusService.create(
          request
        );

  operation$
    .pipe(
      finalize(() => {
        this.isSavingProgress.set(false);
      })
    )
    .subscribe({

      next: savedStatus => {
        this.readingStatus.set(savedStatus);

        this.progressMessage.set(
          `Progreso guardado en el capítulo ${progressValue}.`
        );
      },

      error: () => {
        this.progressError.set(
          'El capítulo cargó, pero no pudimos guardar tu progreso.'
        );
      }

    });
}

    private currentLocalDateTime(): string {

  const now = new Date();

  const offsetInMilliseconds =
    now.getTimezoneOffset() * 60_000;

  return new Date(
    now.getTime() - offsetInMilliseconds
  )
    .toISOString()
    .slice(0, 19);
}


}