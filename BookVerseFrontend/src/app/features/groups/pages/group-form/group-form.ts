import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ReadingGroupsService } from '../../services/reading-groups.service';

type GroupWorkType = 'book' | 'story';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; //modif

@Component({
  selector: 'app-group-form',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './group-form.css',
  templateUrl: './group-form.html',
})
export class GroupForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly readingGroupsService = inject(ReadingGroupsService);
  private readonly router = inject(Router);

  isSaving = false;
  errorMessage = '';

  groupForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    workType: ['book' as GroupWorkType, Validators.required],
    referenceId: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
  });

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

    const request = {
      name: name.trim(),
      bookId: workType === 'book' ? referenceId : null,
      storyId: workType === 'story' ? referenceId : null,
    };

    this.readingGroupsService.create(request).subscribe({
      next: (group) => {
        void this.router.navigate(['/groups', group.idExternal]);
      },
      error: (error: unknown) => {
        console.error('Error creating reading group:', error);
        this.errorMessage =
          'No se pudo crear el círculo. Revisá los datos e intentá nuevamente.';
        this.isSaving = false;
      },
    });
  }
}