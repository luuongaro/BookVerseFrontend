import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { apiError } from '../../../../core/api/api.config';
import { LibrarySaveControl } from '../../../library/components/library-save-control/library-save-control';
import { SendTip } from '../../../tips/components/send-tip/send-tip';
import { UserService } from '../../../profile/services/user.service';
import { ChapterService } from '../../services/chapter.service';
import { ChapterResponse } from '../../models/chapter-response';
import { PageResponse } from '../../models/page-response';

@Component({
  selector: 'app-story-detail',
  imports: [RouterLink, SendTip, LibrarySaveControl],
  templateUrl: './story-detail.html',
  styleUrl: './story-detail.css',
})
export class StoryDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(StoryService);
  private readonly users = inject(UserService);
  readonly favorite = signal<boolean | null>(null);
  readonly favoriteSaving = signal(false);
  readonly favoriteError = signal('');
  private favoriteRequest?: Subscription;
  private readonly permissions = inject(StoryPermissions);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chaptersService = inject(ChapterService);
  readonly writing = this.route.snapshot.data['writing'] === true;
  readonly section = this.writing ? '/writer' : '/stories';
  readonly canSendTip = computed(
    () =>
      !this.writing &&
      !!this.story() &&
      this.story()!.authorId !== localStorage.getItem('userId') &&
      this.story()!.publishedChaptersCount > 0,
  );
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly canManage = computed(
    () => this.writing && !!this.story() && this.permissions.canManage(this.story()!),
  );
  readonly chapterPage = signal<PageResponse<ChapterResponse> | null>(null);
  readonly chaptersLoading = signal(false);
  readonly chaptersError = signal('');
  readonly visibleChapters = computed(() => this.chapterPage()?.content ?? []);
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  readonly deleted = signal(false);
  readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private request?: Subscription;
  private chapterRequest?: Subscription;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.request?.unsubscribe();
    this.favoriteRequest?.unsubscribe();
    this.favorite.set(null);
    this.favoriteError.set('');
    this.chapterRequest?.unsubscribe();
    this.story.set(null);
    this.chapterPage.set(null);
    this.chaptersError.set('');
    this.errorMessage.set('');
    this.deleted.set(false);
    if (!id) {
      this.errorMessage.set('No se pudo identificar la historia.');
      return;
    }
    this.isLoading.set(true);
    this.request = this.service
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (story) => {
          this.story.set(story);
          if (!this.writing) this.loadFavorite(story.idExternal);
          this.loadChapters(story.idExternal, 0);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(apiError(error));
          this.isLoading.set(false);
        },
      });
  }

  loadChapters(storyId: string, page = 0): void {
    if (page < 0) return;

    this.chapterRequest?.unsubscribe();
    this.chaptersLoading.set(true);
    this.chaptersError.set('');

    this.chapterRequest = this.chaptersService
      .getByStory(storyId, page, !this.writing)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.chapterPage.set(result);
          this.chaptersLoading.set(false);
        },
        error: (error) => {
          this.chaptersError.set(apiError(error));
          this.chaptersLoading.set(false);
        },
      });
  }

  confirmDelete(): void {
    if (!this.canManage() || this.deleting() || this.deleted()) return;
    this.deleteError.set('');
    this.deleteDialog().nativeElement.showModal();
  }

  loadFavorite(storyId: string): void {
    this.favoriteRequest?.unsubscribe();
    this.favoriteError.set('');
    this.favoriteRequest = this.users
      .isFavoriteStory(storyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.favorite.set(result.favorite),
        error: () => this.favoriteError.set('No pudimos cargar el estado de favoritas.'),
      });
  }

  toggleFavorite(): void {
    const story = this.story();
    const favorite = this.favorite();
    if (this.writing || !story || favorite === null || this.favoriteSaving()) return;
    this.favoriteSaving.set(true);
    this.favoriteError.set('');
    const request = favorite
      ? this.users.removeFavoriteStory(story.idExternal)
      : this.users.addFavoriteStory(story.idExternal);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.favoriteSaving.set(false);
        if (this.story()?.idExternal === story.idExternal) this.favorite.set(!favorite);
      },
      error: () => {
        this.favoriteSaving.set(false);
        if (this.story()?.idExternal === story.idExternal)
          this.favoriteError.set('No pudimos actualizar tus favoritas. Intentá de nuevo.');
      },
    });
  }

  cancelDelete(): void {
    if (!this.deleting()) this.deleteDialog().nativeElement.close();
  }
  deleteStory(): void {
    const story = this.story();
    if (!story || !this.canManage() || this.deleting() || this.deleted()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.service
      .delete(story.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleted.set(true);
          this.deleteDialog().nativeElement.close();
          void this.router.navigate(['/writer']);
        },
        error: (error) => {
          this.deleting.set(false);
          this.deleteError.set(apiError(error));
        },
      });
  }
}
