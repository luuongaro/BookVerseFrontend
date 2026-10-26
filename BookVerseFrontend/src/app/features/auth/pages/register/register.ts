import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
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

  showPassword = false;
  isSubmitting = false;
  errorMessage = '';

  registerForm = this.formBuilder.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(15),
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
        alert('Cuenta creada correctamente. Ahora podés iniciar sesión.');
        void this.router.navigate(['/login']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;

        this.errorMessage =
          error.status === 409
            ? 'Ese correo o nombre de usuario ya está registrado.'
            : 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.';
      },
    });
  }
}
