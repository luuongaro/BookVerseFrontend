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
  readonly initialDescription = signal('');
  private authorId: string | null = null;
  private request?: Subscription;
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
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.request?.unsubscribe();
      const id = params.get('id');
      this.storyId.set(id);
      this.isEditMode.set(!!id);
      this.form.reset({ title: '', description: '', accessType: StoryAccessType.FREE });
      this.initialDescription.set('');
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
  updateDescription(): void {
    if (!this.descriptionEditor || this.isSaving() || !this.allowed()) return;
    const html =
      this.sanitizer.sanitize(
        SecurityContext.HTML,
        this.descriptionEditor.nativeElement.innerHTML.trim(),
      ) ?? '';
    this.form.controls.description.setValue(html);
    this.form.controls.description.markAsDirty();
    this.form.controls.description.markAsTouched();
  }
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (!this.allowed() || this.isSaving()) return;
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
    this.updateDescription();
  }
  applyFormat(command: string): void {
    if (!this.descriptionEditor || !this.allowed() || this.isSaving()) return;
    this.descriptionEditor.nativeElement.focus();
    document.execCommand(command, false);
    this.updateDescription();
  }
  applyBlockquote(): void {
    if (!this.descriptionEditor || !this.allowed() || this.isSaving()) return;
    this.descriptionEditor.nativeElement.focus();
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
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.form.disable();
    const id = this.storyId();
    const operation = id ? this.service.update(id, request) : this.service.create(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (story) => {
        this.isSaving.set(false);
        this.form.markAsPristine();
        void this.router.navigate(['/stories', story.idExternal]);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.form.enable();
        this.errorMessage.set(apiError(error));
      },
    });
  }
}
