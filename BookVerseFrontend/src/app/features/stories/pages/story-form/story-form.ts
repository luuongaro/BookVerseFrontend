import { CommonModule } from '@angular/common';
import {Component,ElementRef, ViewChild,inject,OnInit,signal} from '@angular/core';

import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';

import {ActivatedRoute,Router,RouterModule} from '@angular/router';

import { finalize } from 'rxjs';

import { StoryAccessType } from '../../models/story-access-type';
import { StoryRequest } from '../../models/story-request';
import { StoryService } from '../../services/story.services';

@Component({
  selector: 'app-story-form',
  imports: [ReactiveFormsModule,RouterModule,CommonModule],
  templateUrl: './story-form.html',
  styleUrl: './story-form.css'
})
export class StoryForm implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storyService = inject(StoryService);

@ViewChild('descriptionEditor')
private descriptionEditor!: ElementRef<HTMLDivElement>;

readonly isEditMode = signal(false);
readonly storyId = signal<string | null>(null);

readonly isLoading = signal(false);
readonly isSaving = signal(false);
readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(150)
      ]
    }),

    description: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(1000)
      ]
    }),

    accessType: new FormControl(StoryAccessType.FREE, {
      nonNullable: true,
      validators: [
        Validators.required
      ]
    })
  });


  ngOnInit(): void {
    const id =
      this.route.snapshot.paramMap.get('id');

    this.storyId.set(id);
    this.isEditMode.set(id !== null);

    if (id) {
      this.loadStory(id);
    }
  }

 private loadStory(id: string): void {

  this.isLoading.set(true);
  this.errorMessage.set(null);

  this.form.disable();

  this.storyService
    .getById(id)
    .pipe(
      finalize(() => {
        this.isLoading.set(false);
        this.form.enable();
      })
    )
    .subscribe({
      next: story => {

        this.form.patchValue({
          title: story.title,
          description: story.description,
          accessType: story.accessType
        });

        setTimeout(() => {

          if (this.descriptionEditor) {

            this.descriptionEditor.nativeElement.innerHTML =
              story.description;

          }

        });

        this.form.markAsPristine();
      },

      error: () => {

        this.errorMessage.set(
          'No pudimos cargar la historia.'
        );

      }
    });

}

updateDescription(): void {

  if (!this.descriptionEditor) {
    return;
  }

  const editor =
    this.descriptionEditor.nativeElement;

  const html =
     editor.innerHTML.trim();

  this.form.controls.description.setValue(
    html
  );

  this.form.controls.description.markAsDirty();
  this.form.controls.description.markAsTouched();
}

applyFormat(command: string): void {

  document.execCommand(
    command,
    false
  );

  this.descriptionEditor.nativeElement.focus();

  this.updateDescription();
}

applyBlockquote(): void {

  document.execCommand(
    'formatBlock',
    false,
    'blockquote'
  );

  this.descriptionEditor.nativeElement.focus();

  this.updateDescription();
}

onSubmit(): void {

  this.updateDescription();

  if (this.isSaving()) {
    return;
  }

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const authorId =
    localStorage.getItem('userId');

  if (!authorId) {

    this.errorMessage.set(
      'No pudimos identificar al usuario que está creando la historia.'
    );

    return;
  }

  const formValue =
    this.form.getRawValue();

  const request: StoryRequest = {
    authorId,
    title: formValue.title.trim(),
    description: formValue.description.trim(),
    accessType: formValue.accessType
  };

  this.isSaving.set(true);
  this.errorMessage.set(null);

  this.form.disable();

  const id = this.storyId();

  const operation$ =
    this.isEditMode() && id
      ? this.storyService.update(id, request)
      : this.storyService.create(request);

  operation$
    .pipe(
      finalize(() => {

        this.isSaving.set(false);
        this.form.enable();

      })
    )
    .subscribe({

      next: story => {

        this.form.markAsPristine();

        void this.router.navigate([
          '/stories',
          story.idExternal
        ]);

      },

      error: () => {

        this.errorMessage.set(
          this.isEditMode()
            ? 'No pudimos guardar los cambios de la historia.'
            : 'No pudimos crear la historia.'
        );

      }

    });

}
}

