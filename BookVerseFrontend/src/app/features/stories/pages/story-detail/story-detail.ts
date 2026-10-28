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
  private readonly permissions = inject(StoryPermissions);
  private readonly destroyRef = inject(DestroyRef);
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly canManage = computed(() => !!this.story() && this.permissions.canManage(this.story()!));
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
          void this.router.navigate(['/stories/mine']);
        },
        error: (error) => {
          this.deleting.set(false);
          this.deleteError.set(apiError(error));
        },
      });
  }
}
