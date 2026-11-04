import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../profile/services/user.service';

@Component({
  selector: 'app-password-recovery',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './password-recovery.html',
  styleUrls: ['../login/login.css', './password-recovery.css'],
})
export class PasswordRecovery {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly resetting = this.route.snapshot.data['mode'] === 'reset';
  private token = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token') ?? '';
  readonly invalidLink = signal(this.resetting && !/^[A-Za-z0-9_-]{43}$/.test(this.token));
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly error = signal('');
  showPassword = false;

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  readonly passwordForm = this.fb.nonNullable.group(
    {
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-]).+$/),
          (control) =>
            new TextEncoder().encode(control.value ?? '').length > 72 ? { byteLength: true } : null,
        ],
      ],
      confirmation: ['', Validators.required],
    },
    {
      validators: (form) =>
        form.get('password')?.value === form.get('confirmation')?.value
          ? null
          : { passwordMismatch: true },
    },
  );

  constructor() {
    if (this.resetting && this.route.snapshot.fragment) {
      this.location.replaceState('/reset-password');
    }
    this.destroyRef.onDestroy(() => {
      this.token = '';
    });
  }

  requestLink(): void {
    if (this.submitting() || this.completed()) return;
    this.emailForm.controls.email.setValue(this.emailForm.controls.email.value.trim());
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.auth
      .requestPasswordReset(this.emailForm.getRawValue().email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.completed.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('No pudimos enviar la solicitud. Intentá nuevamente.');
        },
      });
  }

  resetPassword(): void {
    if (this.submitting() || this.completed() || this.invalidLink()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.auth
      .resetPassword(this.token, this.passwordForm.getRawValue().password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.token = '';
          this.passwordForm.reset();
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          this.users.clearCurrentUser();
          this.submitting.set(false);
          this.completed.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          if (error.status === 410) {
            this.token = '';
            this.passwordForm.reset();
            this.invalidLink.set(true);
          } else {
            this.error.set(
              error.status === 400
                ? 'Revisá que la contraseña cumpla los requisitos.'
                : 'No pudimos cambiar la contraseña. Intentá nuevamente.',
            );
          }
        },
      });
  }

  retryEmail(): void {
    this.completed.set(false);
    this.error.set('');
  }
}
