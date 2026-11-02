import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  SecurityContext,
  signal,
  ViewChild,
  computed,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryAccessType } from '../../models/story-access-type';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { apiError } from '../../../../core/api/api.config';

type StoryFormSection = 'main' | 'description' | 'accessType';

type StoryFormSnapshot = {
  title: string;
  description: string;
  accessType: StoryAccessType;
};

@Component({
  selector: 'app-story-form',
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './story-form.html',
  styleUrl: './story-form.css',
})
export class StoryForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(StoryService);
  private readonly permissions = inject(StoryPermissions);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('descriptionEditor') private descriptionEditor?: ElementRef<HTMLDivElement>;
  readonly isEditMode = signal(false);
  readonly storyId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly loadFailed = signal(false);
  readonly allowed = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly saveSummary = signal<string | null>(null);
  readonly initialDescription = signal('');
  readonly activeSection = signal<StoryFormSection>('main');
  private readonly emptySnapshot: StoryFormSnapshot = {
    title: '',
    description: '',
    accessType: StoryAccessType.FREE,
  };

  readonly originalValues = signal<StoryFormSnapshot>(this.emptySnapshot);
  readonly currentValues = signal<StoryFormSnapshot>(this.emptySnapshot);

  readonly sectionStatus = computed(() => {
    const original = this.originalValues();
    const current = this.currentValues();

    return {
      main: current.title === original.title ? 'Sin cambios' : 'Modificado',
      description:
        current.description === original.description ? 'Sin cambios' : 'Modificado',
      accessType:
        current.accessType === original.accessType ? 'Sin cambios' : 'Modificado',
    };
  });

  private authorId: string | null = null;
  private request?: Subscription;
  @ViewChild('deleteDialog')
  private deleteDialog?: ElementRef<HTMLDialogElement>;
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(1000),
        (control) =>
          String(control.value)
            .replace(/<[^>]*>/g, '')
            .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
            .trim()
            ? null
            : { required: true },
      ],
    }),
    accessType: new FormControl(StoryAccessType.FREE, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentValues.set({
          title: this.form.controls.title.value.trim(),
          description: this.form.controls.description.value.trim(),
          accessType: this.form.controls.accessType.value,
        });
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.request?.unsubscribe();
      const id = params.get('id');
      this.storyId.set(id);
      this.isEditMode.set(!!id);
      this.form.reset({
        title: '',
        description: '',
        accessType: StoryAccessType.FREE,
      });
      this.currentValues.set(this.emptySnapshot);
      this.originalValues.set(this.emptySnapshot);
      this.initialDescription.set('');
      this.activeSection.set('main');
      this.authorId = null;
      this.errorMessage.set(null);
      this.loadFailed.set(false);
      this.allowed.set(!id);
      this.isLoading.set(false);
      if (id) this.load();
      else this.form.enable();
    });
  }
  load(): void {
    const id = this.storyId();
    if (!id) return;
    this.request?.unsubscribe();
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    this.allowed.set(false);
    this.form.disable();
    this.request = this.service
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (story) => {
          this.authorId = story.authorId;
          this.allowed.set(this.permissions.canManage(story));
          this.form.patchValue({
            title: story.title,
            description: story.description,
            accessType: story.accessType,
          });
          const loadedValues: StoryFormSnapshot = {
            title: story.title.trim(),
            description: story.description.trim(),
            accessType: story.accessType,
          };

          this.originalValues.set(loadedValues);
          this.currentValues.set(loadedValues);
          this.initialDescription.set(story.description);
          this.form.markAsPristine();
          this.isLoading.set(false);
          if (this.allowed()) this.form.enable();
          else this.errorMessage.set('No tenés permiso para editar esta historia.');
        },
        error: (error) => {
          this.isLoading.set(false);
          this.loadFailed.set(true);
          this.errorMessage.set(apiError(error));
        },
      });
  }

  selectSection(section: StoryFormSection): void {
    this.activeSection.set(section);
    document
      .getElementById(`story-${section}-section`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private getSectionChanges(): { changed: string[]; unchanged: string[] } {
    const original = this.originalValues();
    const current = this.form.getRawValue();

    const sections = [
      {
        label: 'Datos principales',
        changed: current.title !== original.title,
      },
      {
        label: 'Descripción',
        changed: current.description !== original.description,
      },
      {
        label: 'Tipo de acceso',
        changed: current.accessType !== original.accessType,
      },
    ];

    return {
      changed: sections.filter((section) => section.changed).map((section) => section.label),
      unchanged: sections.filter((section) => !section.changed).map((section) => section.label),
    };
  }

  openDeleteDialog(): void {
    if (
      !this.isEditMode() ||
      !this.storyId() ||
      !this.allowed() ||
      this.isSaving() ||
      this.isDeleting()
    ) {
      return;
    }

    this.deleteError.set(null);
    this.deleteDialog?.nativeElement.showModal();
  }

  cancelStoryDelete(): void {
    if (!this.isDeleting()) {
      this.deleteDialog?.nativeElement.close();
    }
  }

  deleteStory(): void {
    const id = this.storyId();

    if (!id || !this.isEditMode() || !this.allowed() || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.deleteError.set(null);

    this.service
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteDialog?.nativeElement.close();
          void this.router.navigate(['/writer']);
        },
        error: (error) => {
          this.isDeleting.set(false);
          this.deleteError.set(apiError(error));
        },
      });
  }

  updateDescription(): void {
    const html = this.descriptionEditor?.nativeElement.innerHTML ?? '';
    const safeHtml = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';

    this.form.controls.description.setValue(safeHtml);
    this.form.controls.description.markAsDirty();
  }
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (!this.allowed() || this.isSaving()) return;
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
    this.updateDescription();
  }
  applyFormat(command: string): void {
    if (!this.allowed() || this.isSaving()) {
      return;
    }

    document.execCommand(command, false);
    this.updateDescription();
  }

  applyBlockquote(): void {
    if (!this.allowed() || this.isSaving()) {
      return;
    }

    document.execCommand('formatBlock', false, 'blockquote');
    this.updateDescription();
  }
  onSubmit(): void {
    if (this.isLoading() || this.isSaving() || this.loadFailed() || !this.allowed()) return;
    this.updateDescription();
    this.form.controls.title.setValue(this.form.controls.title.value.trim());
    this.form.controls.description.setValue(this.form.controls.description.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const authorId = this.isEditMode() ? this.authorId : localStorage.getItem('userId');
    if (!authorId) {
      this.errorMessage.set('Volvé a iniciar sesión para guardar la historia.');
      return;
    }
    const request = { ...this.form.getRawValue(), authorId };
    const sectionChanges = this.getSectionChanges();
    this.saveSummary.set(null);
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.form.disable();
    const id = this.storyId();
    const operation = id ? this.service.update(id, request) : this.service.create(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (story) => {
        this.isSaving.set(false);

        if (id) {
          this.form.enable();
          this.form.patchValue({
            title: story.title,
            description: story.description,
            accessType: story.accessType,
          });

          this.initialDescription.set(story.description);
          this.form.markAsPristine();
          const savedValues: StoryFormSnapshot = {
            title: story.title.trim(),
            description: story.description.trim(),
            accessType: story.accessType,
          };
          this.originalValues.set(savedValues);
          this.currentValues.set(savedValues);

          const changedMessage = sectionChanges.changed.length
            ? `Se modificó: ${sectionChanges.changed.join(', ')}.`
            : 'No se detectaron cambios.';

          const unchangedMessage = sectionChanges.unchanged.length
            ? ` Sin cambios: ${sectionChanges.unchanged.join(', ')}.`
            : '';

          this.saveSummary.set(changedMessage + unchangedMessage);
          return;
        }

        this.form.markAsPristine();
        void this.router.navigate(['/writer']);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.form.enable();
        this.errorMessage.set(apiError(error));
      },
    });
  }
}
