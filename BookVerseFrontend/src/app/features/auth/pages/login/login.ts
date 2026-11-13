import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { SessionExpiredService } from '../../../../core/services/session-expired.service';
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
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private sessionExpired = inject(SessionExpiredService);
  private destroyRef = inject(DestroyRef);

  showPassword = false;
  signingIn = false;
  entering = false;
  private navigationTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.navigationTimer));
  }

  loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/dashboard';
  }

  onSubmit(): void {
    if (this.signingIn) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.signingIn = true;
    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', response.userId);

        this.userService.getByIdExternal(response.userId).subscribe({
          next: (user) => {
            this.userService.setCurrentUser(user);
            this.sessionExpired.clear();
            this.entering = true;
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            this.navigationTimer = setTimeout(() => {
              void this.router.navigateByUrl(this.getReturnUrl());
            }, reducedMotion ? 0 : 1100);
          },
          error: () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            this.userService.clearCurrentUser();
            this.signingIn = false;
            alert('Iniciaste sesión, pero no se pudo cargar tu perfil.');
          },
        });
      },
      error: () => {
        this.signingIn = false;
        alert('No se pudo iniciar sesión. Revisá el email y la contraseña.');
      },
    });
  }
}
