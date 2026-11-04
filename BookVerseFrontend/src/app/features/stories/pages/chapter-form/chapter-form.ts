import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  SecurityContext,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  finalize,
  forkJoin,
  of,
  Subscription,
  TimeoutError,
  timeout,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoryDetailResponse } from '../../models/story-detail-response';
import { ChapterService } from '../../services/chapter.service';
import { StoryService } from '../../services/story.services';
import { StoryPermissions } from '../../services/story-permissions.service';
import { apiError } from '../../../../core/api/api.config';

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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contentEditor = viewChild<ElementRef<HTMLDivElement>>('contentEditor');
  readonly initialContent = signal('');
  readonly storyId = signal<string | null>(null);
  readonly chapterId = signal<string | null>(null);
  readonly story = signal<StoryDetailResponse | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly savingAction = signal<'draft' | 'publish' | null>(null);
  readonly loadFailed = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly isEditMode = computed(() => this.chapterId() !== null);
  readonly canManage = computed(() => !!this.story() && this.permissions.canManage(this.story()!));
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Editar capítulo' : 'Nuevo capítulo'));
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
  private request?: Subscription;
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    content: [
      '',
      [
        Validators.required,
        (control) => {
          const element = this.document.createElement('div');
          element.innerHTML = this.sanitizeContent(String(control.value));
          return element.textContent?.trim() ? null : { required: true };
        },
      ],
    ],
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
    this.initialContent.set('');
    this.toolbarState.set({ ...EMPTY_TOOLBAR_STATE });
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
          if (chapter) {
            const content = this.sanitizeContent(chapter.content);
            this.form.patchValue({
              title: chapter.title,
              content,
              published: chapter.published,
            });
            this.initialContent.set(content);
          }
          this.form.markAsPristine();
          this.form.enable();
          this.restoreLocalDraft();
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
    if (!this.isSaving()) void this.router.navigate(['/writer']);
  }

  private localDraftKey(): string | null {
    const userId = localStorage.getItem('userId');
    const storyId = this.storyId();

    if (!userId || !storyId) return null;

    const chapterId = this.chapterId() ?? 'new';
    return `bookverse:draft:chapter:${userId}:${storyId}:${chapterId}`;
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
          content: this.sanitizeContent(value.content),
        }),
      );
    } catch {
      // Si el almacenamiento local no está disponible, el formulario sigue funcionando.
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
        content?: unknown;
      };

      if (typeof draft.title !== 'string' || typeof draft.content !== 'string') {
        return;
      }

      const content = this.sanitizeContent(draft.content);
      const current = this.form.getRawValue();

      if (draft.title === current.title && content === current.content) {
        this.clearLocalDraft();
        return;
      }

      this.form.patchValue({
        title: draft.title,
        content,
      });

      this.initialContent.set(content);
      this.form.markAsDirty();
      this.saveMessage.set('Recuperamos el borrador guardado en este dispositivo.');
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

  updateContent(): void {
    const editor = this.contentEditor()?.nativeElement;
    if (!editor || this.form.controls.content.disabled) return;
    this.form.controls.content.setValue(this.sanitizeContent(editor.innerHTML));
    this.form.controls.content.markAsDirty();
    this.saveLocalDraft();
    this.refreshToolbarState();
  }
  markContentTouched(): void {
    this.form.controls.content.markAsTouched();
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    this.refreshToolbarState();
  }

  refreshToolbarState(): void {
    const editor = this.contentEditor()?.nativeElement;
    const selection = this.document.getSelection();
    const node = selection?.anchorNode;

    if (!editor || !node || !editor.contains(node)) {
      this.toolbarState.set({ ...EMPTY_TOOLBAR_STATE });
      return;
    }

    const anchorElement =
      node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
    const alignment =
      ALIGNMENT_ORDER.find((value) => this.document.queryCommandState(ALIGNMENT_COMMANDS[value])) ??
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
    const editor = this.contentEditor()?.nativeElement;
    if (!editor || this.form.controls.content.disabled) return;

    editor.focus();
    this.document.execCommand(command, false, value);
    this.updateContent();
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

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.runEditorCommand(
      'insertText',
      event.clipboardData?.getData('text/plain') ?? '',
    );
  }
  private sanitizeContent(content: string): string {
    const element = this.document.createElement('div');
    element.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, content.trim()) ?? '';
    return element.innerHTML;
  }
  private submitForm(published: boolean): void {
    if (
      this.isLoading() ||
      this.isSaving() ||
      this.loadFailed() ||
      !this.canManage()
    ) {
      return;
    }

    const raw = this.form.getRawValue();

    this.form.patchValue({
      title: raw.title.trim(),
      content: this.sanitizeContent(raw.content),
    });

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const chapterId = this.chapterId();
    const request = { title: value.title, content: value.content, published };

    this.saveLocalDraft();
    this.savingAction.set(published ? 'publish' : 'draft');
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.form.disable();

    const operation = chapterId
      ? this.service.update(chapterId, request)
      : this.service.create({ ...request, storyId: this.storyId()! });

    operation
      .pipe(
        timeout({ first: 60_000 }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSaving.set(false);
          this.savingAction.set(null);

          if (this.canManage()) {
            this.form.enable();
          }
        }),
      )
      .subscribe({
        next: () => {
          // Solo la respuesta exitosa cambia el estado a Publicado.
          this.form.controls.published.setValue(published);
          this.form.markAsPristine();
          this.clearLocalDraft();
          void this.router.navigate(['/writer']);
        },
        error: (error) => {
          if (error instanceof TimeoutError) {
            this.errorMessage.set(
              'La respuesta tardó demasiado. Conservamos el borrador. Revisá el Escritorio antes de volver a publicar.',
            );
            return;
          }

          this.errorMessage.set(apiError(error));
        },
      });
  }
}
