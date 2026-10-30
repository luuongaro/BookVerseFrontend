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
import { LibraryService, libraryError } from '../../../library/services/library.service';
import { TipService } from '../../../tips/services/tip.service';

@Component({
  selector: 'app-story-detail',
  imports: [RouterLink],
  templateUrl: './story-detail.html',
  styleUrl: './story-detail.css',
})
export class StoryDetail implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(StoryService);
  private readonly tips = inject(TipService);
  private readonly permissions = inject(StoryPermissions);
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  readonly writing = this.route.snapshot.data['writing'] === true;
  readonly section = this.writing ? '/writer' : '/stories';
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal('');
  readonly tipping = signal(false);
  readonly tipError = signal('');
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly canManage = computed(
    () => this.writing && !!this.story() && this.permissions.canManage(this.story()!),
  );
  readonly visibleChapters = computed(
    () => this.story()?.chapters.filter((chapter) => this.canManage() || chapter.published) ?? [],
  );
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  readonly deleted = signal(false);
  readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private request?: Subscription;
  
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.request?.unsubscribe();
    this.story.set(null);
    this.saved.set(false);
    this.saveError.set('');
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
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(apiError(error));
          this.isLoading.set(false);
        },
      });
  }
  confirmDelete(): void {
    if (!this.canManage() || this.deleting() || this.deleted()) return;
    this.deleteError.set('');
    this.deleteDialog().nativeElement.showModal();
  }
  saveToLibrary(): void {
    const story = this.story();
    if (this.writing || !story || this.saving() || this.saved()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.library
      .saveStory(story.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (error) => {
          this.saving.set(false);
          this.saveError.set(libraryError(error));
        },
      });
  }
  
  sendTip(amount: number): void {
  const story = this.story();

  if (!story || this.writing || this.tipping()) return;

  this.tipping.set(true);
  this.tipError.set('');

  this.tips
    .createTip({
      storyId: story.idExternal,
      amount,
      message: `Cafecito para ${story.title}`,
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (response) => {
        this.tipping.set(false);
        window.location.href = response.checkout.checkoutUrl;
      },
      error: (error) => {
        this.tipping.set(false);
        this.tipError.set(apiError(error));
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
