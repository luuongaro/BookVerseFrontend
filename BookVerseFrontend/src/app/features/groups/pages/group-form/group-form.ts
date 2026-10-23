import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ReadingGroupsService } from '../../services/reading-groups.service';

type GroupWorkType = 'book' | 'story';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-group-form',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './group-form.css',
  templateUrl: './group-form.html',
})
export class GroupForm implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  groupId: string | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  groupForm = this.formBuilder.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(60),
      ],
    ],
    workType: ['book' as GroupWorkType, Validators.required],
    referenceId: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
  });

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('id');

    if (this.groupId) {
      this.loadGroup(this.groupId);
    }
  }

  private loadGroup(groupId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.readingGroupsService
      .getById(groupId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (group) => {
          this.groupForm.patchValue({
            name: group.name,
            workType: group.storyId ? 'story' : 'book',
            referenceId: group.storyId ?? group.bookId ?? '',
          });

          // El backend solo permite cambiar el nombre del grupo.
          this.groupForm.controls.workType.disable();
          this.groupForm.controls.referenceId.disable();

          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading reading group for edit:', error);
          this.errorMessage = 'No se pudo cargar el círculo para editarlo.';
          this.cdr.markForCheck();
        },
      });
  }

  get isEditing(): boolean {
    return this.groupId !== null;
  }

  get referenceLabel(): string {
    return this.groupForm.controls.workType.value === 'book'
      ? 'UUID del libro'
      : 'UUID de la historia';
  }

  onSubmit(): void {
    if (this.groupForm.invalid || this.isSaving) {
      this.groupForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSaving = true;

    const { name, workType, referenceId } = this.groupForm.getRawValue();
    const normalizedName = name.trim();

    if (this.groupId) {
      this.readingGroupsService
        .update(this.groupId, { name: normalizedName })
        .subscribe({
          next: () => {
            void this.router.navigate(['/groups', this.groupId]);
          },
          error: (error: unknown) => {
            console.error('Error updating reading group:', error);
            this.errorMessage =
              'No se pudo actualizar el círculo. Revisá los permisos e intentá nuevamente.';
            this.isSaving = false;
            this.cdr.markForCheck();
          },
        });

      return;
    }

    this.readingGroupsService
      .create({
        name: normalizedName,
        bookId: workType === 'book' ? referenceId : null,
        storyId: workType === 'story' ? referenceId : null,
      })
      .subscribe({
        next: (group) => {
          void this.router.navigate(['/groups', group.idExternal]);
        },
        error: (error: unknown) => {
          console.error('Error creating reading group:', error);
          this.errorMessage =
            'No se pudo crear el círculo. Revisá los datos e intentá nuevamente.';
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
  }
}