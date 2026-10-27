import { CommonModule } from '@angular/common';

import {Component,computed,inject,OnInit,signal} from '@angular/core';

import {
  ActivatedRoute,
  RouterModule
} from '@angular/router';

import { finalize } from 'rxjs';

import { Sidebar } from '../../../../shared/components/sidebar/sidebar';

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
  imports: [CommonModule,RouterModule,Sidebar],
  templateUrl: './chapter-reader.html',
  styleUrl: './chapter-reader.css'
})
export class ChapterReader implements OnInit {

  private readonly route = inject(ActivatedRoute);

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
  this.route.paramMap.subscribe(params => {

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

  private loadChapter(
    chapterId: string
  ): void {

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.chapter.set(null);

    this.chapterService
      .getById(chapterId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe({

        next: chapter => {
  this.chapter.set(chapter);
  this.registerReadingProgress(chapter);
},

        error: () => {
          this.errorMessage.set(
            'No pudimos cargar el capítulo.'
          );
        }

      });
  }

  private loadStory(
  storyId: string
): void {

  this.storyService
    .getById(storyId)
    .subscribe({

      next: story => {
        this.story.set(story);
      },

      error: () => {
        this.errorMessage.set(
          'No pudimos cargar la historia.'
        );
      }

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