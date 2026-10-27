import { CommonModule } from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterModule
} from '@angular/router';

import { finalize } from 'rxjs';

import { Sidebar } from '../../../../shared/components/sidebar/sidebar';

import { ChapterCreateRequest } from '../../models/chapter-create-request';
import { ChapterUpdateRequest } from '../../models/chapter-update-request';
import { StoryDetailResponse } from '../../models/story-detail-response';

import { ChapterService } from '../../services/chapter.service';
import { StoryService } from '../../services/story.services';

@Component({
  selector: 'app-chapter-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    Sidebar
  ],
  templateUrl: './chapter-form.html',
  styleUrl: './chapter-form.css'
})
export class ChapterForm implements OnInit {

  private readonly formBuilder =
    inject(FormBuilder);

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly chapterService =
    inject(ChapterService);

  private readonly storyService =
    inject(StoryService);

  readonly storyId =
    signal<string | null>(null);

  readonly chapterId =
    signal<string | null>(null);

  readonly story =
    signal<StoryDetailResponse | null>(null);

  readonly isLoading =
    signal(false);

  readonly isSaving =
    signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly saveMessage =
    signal<string | null>(null);

  readonly isEditMode = computed(
    () => this.chapterId() !== null
  );

  readonly pageTitle = computed(
    () =>
      this.isEditMode()
        ? 'Editar capítulo'
        : 'Nuevo capítulo'
  );

  readonly submitLabel = computed(
    () =>
      this.isEditMode()
        ? 'Guardar cambios'
        : 'Crear capítulo'
  );

  readonly form = this.formBuilder.nonNullable.group({
    title: [
      '',
      [
        Validators.required,
        Validators.maxLength(150)
      ]
    ],
    content: [
      '',
      [
        Validators.required
      ]
    ],
    published: [
      false
    ]
  });

  ngOnInit(): void {

    this.route.paramMap.subscribe(params => {

      const storyId =
        params.get('id');

      const chapterId =
        params.get('chapterId');

      this.storyId.set(storyId);
      this.chapterId.set(chapterId);

      if (!storyId) {
        this.errorMessage.set(
          'No pudimos identificar la historia.'
        );

        this.form.disable();

        return;
      }

      this.loadStory(storyId);

      if (chapterId) {
        this.loadChapter(chapterId);
      }
    });
  }

  saveDraft(): void {

    this.form.controls.published.setValue(false);

    this.submitForm();
  }

  publish(): void {

    this.form.controls.published.setValue(true);

    this.submitForm();
  }

  cancel(): void {

    const storyId =
      this.storyId();

    if (!storyId) {
      void this.router.navigateByUrl('/stories');
      return;
    }

    void this.router.navigate([
      '/stories',
      storyId,
      'chapters'
    ]);
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

  private loadChapter(
    chapterId: string
  ): void {

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.form.disable();

    this.chapterService
      .getById(chapterId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.form.enable();
        })
      )
      .subscribe({

        next: chapter => {

          this.form.patchValue({
            title: chapter.title,
            content: chapter.content,
            published: chapter.published
          });

        },

        error: () => {

          this.errorMessage.set(
            'No pudimos cargar el capítulo.'
          );

        }

      });
  }

  private submitForm(): void {

    this.form.markAllAsTouched();

    if (
      this.form.invalid ||
      this.isSaving()
    ) {
      return;
    }

    const storyId =
      this.storyId();

    if (!storyId) {
      this.errorMessage.set(
        'No pudimos identificar la historia.'
      );

      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.saveMessage.set(null);
    this.form.disable();

    const formValue =
      this.form.getRawValue();

    const request$ =
      this.isEditMode()
        ? this.updateChapter(
            formValue.title,
            formValue.content,
            formValue.published
          )
        : this.createChapter(
            storyId,
            formValue.title,
            formValue.content,
            formValue.published
          );

    if (!request$) {
      this.isSaving.set(false);
      this.form.enable();
      return;
    }

    request$
      .pipe(
        finalize(() => {
          this.isSaving.set(false);
          this.form.enable();
        })
      )
      .subscribe({

        next: savedChapter => {

          this.saveMessage.set(
            savedChapter.published
              ? 'Capítulo publicado correctamente.'
              : 'Borrador guardado correctamente.'
          );

          void this.router.navigate([
            '/stories',
            storyId,
            'chapters'
          ]);

        },

        error: () => {

          this.errorMessage.set(
            this.isEditMode()
              ? 'No pudimos actualizar el capítulo.'
              : 'No pudimos crear el capítulo.'
          );

        }

      });
  }

  private createChapter(
    storyId: string,
    title: string,
    content: string,
    published: boolean
  ) {

    const request: ChapterCreateRequest = {
      storyId,
      title: title.trim(),
      content: content.trim(),
      published
    };

    return this.chapterService.create(
      request
    );
  }

  private updateChapter(
    title: string,
    content: string,
    published: boolean
  ) {

    const chapterId =
      this.chapterId();

    if (!chapterId) {
      this.errorMessage.set(
        'No pudimos identificar el capítulo.'
      );

      return null;
    }

    const request: ChapterUpdateRequest = {
      title: title.trim(),
      content: content.trim(),
      published
    };

    return this.chapterService.update(
      chapterId,
      request
    );
  }
}