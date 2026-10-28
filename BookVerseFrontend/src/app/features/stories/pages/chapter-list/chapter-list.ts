import { CommonModule } from '@angular/common';
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
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChapterResponse } from '../../models/chapter-response';
import { ChapterService } from '../../services/chapter.service';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { PageResponse } from '../../models/page-response';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-chapter-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './chapter-list.html',
  styleUrl: './chapter-list.css',
})
export class ChapterList implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ChapterService);
  private readonly stories = inject(StoryService);
  private readonly permissions = inject(StoryPermissions);
  private readonly destroyRef = inject(DestroyRef);
  readonly storyId = signal<string | null>(null);
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly result = signal<PageResponse<ChapterResponse> | null>(null);
  readonly chapters = computed(() => this.result()?.content ?? []);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canManage = computed(() => !!this.story() && this.permissions.canManage(this.story()!));
  readonly deleting = signal(false);
  readonly selectedChapter = signal<ChapterResponse | null>(null);
  readonly deleteError = signal('');
  readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private request?: Subscription;
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.storyId.set(params.get('id'));
      this.load();
    });
  }
  load(page = 0): void {
    const id = this.storyId();
    if (page < 0) return;
    this.request?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.story.set(null);
    if (!id) {
      this.isLoading.set(false);
      this.errorMessage.set('No se pudo identificar la historia.');
      return;
    }
    this.request = forkJoin({
      story: this.stories.getById(id),
      result: this.service.getByStory(id, page),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ story, result }) => {
          this.story.set(story);
          this.result.set(result);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(apiError(error));
          this.isLoading.set(false);
        },
      });
  }
  confirmDelete(chapter: ChapterResponse): void {
    if (!this.canManage() || this.deleting() || chapter.storyId !== this.storyId()) return;
    this.selectedChapter.set(chapter);
    this.deleteError.set('');
    this.deleteDialog().nativeElement.showModal();
  }
  cancelDelete(): void {
    if (!this.deleting()) this.deleteDialog().nativeElement.close();
  }
  deleteChapter(): void {
    const chapter = this.selectedChapter();
    if (!chapter || !this.canManage() || this.deleting() || chapter.storyId !== this.storyId())
      return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.service
      .delete(chapter.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const result = this.result();
          const page = result?.number ?? 0;
          this.selectedChapter.set(null);
          this.deleting.set(false);
          this.deleteDialog().nativeElement.close();
          this.load(page > 0 && result?.content.length === 1 ? page - 1 : page);
        },
        error: (error) => {
          this.deleting.set(false);
          this.deleteError.set(apiError(error));
        },
      });
  }
}
