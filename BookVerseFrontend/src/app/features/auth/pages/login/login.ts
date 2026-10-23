import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../profile/services/user.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);

  showPassword = false;

  loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', response.userId);

        this.userService.getByIdExternal(response.userId).subscribe({
          next: (user) => {
            this.userService.setCurrentUser(user);
            void this.router.navigate(['/dashboard']);
          },
          error: () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            this.userService.clearCurrentUser();
            alert('Iniciaste sesión, pero no se pudo cargar tu perfil.');
          },
        });
      },
      error: () => {
        alert('No se pudo iniciar sesión. Revisá el email y la contraseña.');
      },
    });
  }
}
