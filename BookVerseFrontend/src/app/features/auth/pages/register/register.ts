import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  showPassword = false;
  isSubmitting = false;
  errorMessage = '';

  registerForm = this.formBuilder.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
      ],
    ],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100),
        Validators.pattern(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-]).{8,100}$/,
        ),
      ],
    ],
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.registerForm.invalid || this.isSubmitting) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService.register(this.registerForm.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
        alert('Cuenta creada correctamente. Ahora podés iniciar sesión.');
        void this.router.navigate(['/login']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;

        const serverMessage = String(
          error.error?.message ?? error.error?.detail ?? '',
        ).toLocaleLowerCase();

        this.errorMessage =
          error.status === 409 && serverMessage.includes('email')
            ? 'Este correo ya está registrado. Iniciá sesión o usá otro correo.'
            : error.status === 409 && serverMessage.includes('username')
              ? 'Ese nombre de usuario ya está registrado. Elegí otro.'
              : error.status === 409
                ? 'El correo o nombre de usuario ya está registrado.'
                : 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.';
        this.cdr.markForCheck();
      },
    });
  }
}
