import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { ChapterService } from '../../services/chapter.service';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-chapter-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './chapter-form.html',
  styleUrl: './chapter-form.css',
})
export class ChapterForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ChapterService);
  private readonly stories = inject(StoryService);
  private readonly permissions = inject(StoryPermissions);
  private readonly destroyRef = inject(DestroyRef);
  readonly storyId = signal<string | null>(null);
  readonly chapterId = signal<string | null>(null);
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadFailed = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly isEditMode = computed(() => this.chapterId() !== null);
  readonly canManage = computed(() => !!this.story() && this.permissions.canManage(this.story()!));
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Editar capítulo' : 'Nuevo capítulo'));
  private request?: Subscription;
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    content: ['', [Validators.required, Validators.pattern(/\S/)]],
    published: [false],
  });
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.storyId.set(params.get('id'));
      this.chapterId.set(params.get('chapterId'));
      this.load();
    });
  }
  load(): void {
    this.request?.unsubscribe();
    this.form.reset({ title: '', content: '', published: false });
    this.form.disable();
    this.story.set(null);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    this.saveMessage.set(null);
    this.isLoading.set(true);
    const storyId = this.storyId();
    const chapterId = this.chapterId();
    if (!storyId) {
      this.isLoading.set(false);
      this.loadFailed.set(true);
      this.errorMessage.set('No se pudo identificar la historia.');
      return;
    }
    this.request = forkJoin({
      story: this.stories.getById(storyId),
      chapter: chapterId ? this.service.getById(chapterId) : of(null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ story, chapter }) => {
          this.isLoading.set(false);
          if (chapter && chapter.storyId !== storyId) {
            this.loadFailed.set(true);
            this.errorMessage.set('El capítulo no pertenece a esta historia.');
            return;
          }
          this.story.set(story);
          if (!this.canManage()) {
            this.errorMessage.set(
              'No tenés permiso para gestionar los capítulos de esta historia.',
            );
            return;
          }
          if (chapter)
            this.form.patchValue({
              title: chapter.title,
              content: chapter.content,
              published: chapter.published,
            });
          this.form.markAsPristine();
          this.form.enable();
        },
        error: (error) => {
          this.isLoading.set(false);
          this.loadFailed.set(true);
          this.errorMessage.set(apiError(error));
        },
      });
  }
  saveDraft(): void {
    this.submitForm(false);
  }
  publish(): void {
    this.submitForm(true);
  }
  cancel(): void {
    if (!this.isSaving()) void this.router.navigate(['/stories', this.storyId(), 'chapters']);
  }
  private submitForm(published: boolean): void {
    if (this.isLoading() || this.isSaving() || this.loadFailed() || !this.canManage()) return;
    const raw = this.form.getRawValue();
    this.form.patchValue({ title: raw.title.trim(), content: raw.content.trim(), published });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const chapterId = this.chapterId();
    const request = { title: value.title, content: value.content, published };
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.form.disable();
    const operation = chapterId
      ? this.service.update(chapterId, request)
      : this.service.create({ ...request, storyId: this.storyId()! });
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.form.markAsPristine();
        void this.router.navigate(['/stories', this.storyId(), 'chapters']);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.form.enable();
        this.errorMessage.set(apiError(error));
      },
    });
  }
}
