import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
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
import { finalize, Subscription, TimeoutError, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryAccessType } from '../../models/story-access-type';
import { StoryRequest } from '../../models/story-request';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { apiError } from '../../../../core/api/api.config';

type StoryFormSection = 'main' | 'description' | 'accessType';

type TextAlignment = 'left' | 'center' | 'right' | 'justify';

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  list: boolean;
  quote: boolean;
  alignment: TextAlignment;
};

const EMPTY_TOOLBAR_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  list: false,
  quote: false,
  alignment: 'left',
};

const ALIGNMENT_COMMANDS: Record<TextAlignment, string> = {
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
  justify: 'justifyFull',
};

const ALIGNMENT_ORDER: TextAlignment[] = ['left', 'center', 'right', 'justify'];

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
  private readonly document = inject(DOCUMENT);
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
  readonly toolbarState = signal<ToolbarState>({ ...EMPTY_TOOLBAR_STATE });
  readonly alignmentLabel = computed(() => {
    const labels: Record<TextAlignment, string> = {
      left: 'izquierda',
      center: 'centrada',
      right: 'derecha',
      justify: 'justificada',
    };

    return labels[this.toolbarState().alignment];
  });
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
      this.toolbarState.set({ ...EMPTY_TOOLBAR_STATE });
      this.activeSection.set('main');
      this.errorMessage.set(null);
      this.loadFailed.set(false);
      this.allowed.set(!id);
      this.isLoading.set(false);
      if (id) this.load();
      else {
        this.form.enable();
        this.restoreLocalDraft();
      }
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
          if (this.allowed()) {
            this.form.enable();
            this.restoreLocalDraft();
          } else {
            this.errorMessage.set('No tenés permiso para editar esta historia.');
          }
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

  private localDraftKey(): string | null {
    const userId = localStorage.getItem('userId');
    if (!userId) return null;

    const storyId = this.storyId() ?? 'new';
    return `bookverse:draft:story:${userId}:${storyId}`;
  }

  saveLocalDraft(): void {
    const key = this.localDraftKey();
    if (!key) return;

    try {
      const value = this.form.getRawValue();

      localStorage.setItem(
        key,
        JSON.stringify({
          title: value.title,
          description: value.description,
          accessType: value.accessType,
        }),
      );
    } catch {
      // El formulario sigue funcionando si el almacenamiento local no está disponible.
    }
  }

  private restoreLocalDraft(): void {
    const key = this.localDraftKey();
    if (!key) return;

    try {
      const saved = localStorage.getItem(key);
      if (!saved) return;

      const draft = JSON.parse(saved) as {
        title?: unknown;
        description?: unknown;
        accessType?: unknown;
      };

      if (
        typeof draft.title !== 'string' ||
        typeof draft.description !== 'string' ||
        (draft.accessType !== StoryAccessType.FREE &&
          draft.accessType !== StoryAccessType.PREMIUM)
      ) {
        return;
      }

      const description =
        this.sanitizer.sanitize(SecurityContext.HTML, draft.description) ?? '';

      this.form.patchValue({
        title: draft.title,
        description,
        accessType: draft.accessType,
      });

      this.initialDescription.set(description);
      this.form.markAsDirty();
      this.saveSummary.set(
        'Recuperamos el borrador local. Guardá los cambios para conservarlo.',
      );
    } catch {
      // Un borrador ilegible no debe impedir la edición.
    }
  }

  private clearLocalDraft(): void {
    const key = this.localDraftKey();
    if (!key) return;

    try {
      localStorage.removeItem(key);
    } catch {
      // El guardado en el servidor no depende del almacenamiento local.
    }
  }

  updateDescription(): void {
    const html = this.descriptionEditor?.nativeElement.innerHTML ?? '';
    const safeHtml = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';

    this.form.controls.description.setValue(safeHtml);
    this.form.controls.description.markAsDirty();
    this.saveLocalDraft();
    this.refreshToolbarState();
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    this.refreshToolbarState();
  }

  refreshToolbarState(): void {
    const editor = this.descriptionEditor?.nativeElement;
    const selection = this.document.getSelection();
    const node = selection?.anchorNode;

    if (!editor || !node || !editor.contains(node)) {
      this.toolbarState.set({ ...EMPTY_TOOLBAR_STATE });
      return;
    }

    const anchorElement =
      node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
    const alignment =
      ALIGNMENT_ORDER.find((value) =>
        this.document.queryCommandState(ALIGNMENT_COMMANDS[value]),
      ) ??
      'left';

    this.toolbarState.set({
      bold: this.document.queryCommandState('bold'),
      italic: this.document.queryCommandState('italic'),
      underline: this.document.queryCommandState('underline'),
      list: this.document.queryCommandState('insertUnorderedList'),
      quote: !!anchorElement?.closest('blockquote'),
      alignment,
    });
  }

  runEditorCommand(command: string, value?: string): void {
    const editor = this.descriptionEditor?.nativeElement;
    if (!editor || !this.allowed() || this.isSaving()) return;

    editor.focus();
    this.document.execCommand(command, false, value);
    this.updateDescription();
    this.refreshToolbarState();
  }

  cycleAlignment(): void {
    const current = this.toolbarState().alignment;
    const currentIndex = ALIGNMENT_ORDER.indexOf(current);
    const next = ALIGNMENT_ORDER[(currentIndex + 1) % ALIGNMENT_ORDER.length];

    this.runEditorCommand(ALIGNMENT_COMMANDS[next]);
  }

  toggleList(): void {
    this.runEditorCommand('insertUnorderedList');
  }

  toggleQuote(): void {
    const command = this.toolbarState().quote ? 'p' : 'blockquote';
    this.runEditorCommand('formatBlock', command);
  }

  undo(): void {
    this.runEditorCommand('undo');
  }

  redo(): void {
    this.runEditorCommand('redo');
  }

  applyFormat(command: string): void {
    this.runEditorCommand(command);
  }

  applyBlockquote(): void {
    this.toggleQuote();
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.runEditorCommand(
      'insertText',
      event.clipboardData?.getData('text/plain') ?? '',
    );
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
    const request: StoryRequest = this.form.getRawValue();
    const sectionChanges = this.getSectionChanges();
    this.saveLocalDraft();
    this.saveSummary.set(null);
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.form.disable();
    const id = this.storyId();
    const operation = id
      ? this.service.update(id, request)
      : this.service.create(request);
    operation
      .pipe(
        timeout({ first: 60_000 }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving.set(false);

          if (this.allowed()) {
            this.form.enable();
          }
        }),
      )
      .subscribe({
        next: (story) => {
          this.clearLocalDraft();

          if (id) {
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
          this.errorMessage.set(
            error instanceof TimeoutError
              ? 'La respuesta tardó demasiado. Conservamos el borrador; revisá el Escritorio antes de volver a guardar.'
              : apiError(error),
          );
        },
      });
  }
}
