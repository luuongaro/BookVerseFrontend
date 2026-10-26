import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const authenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);
  const tokenService = inject(TokenService);

  return tokenService.isAuthenticated()
    ? true
    : router.parseUrl('/login');
};

export const moderatorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const tokenService = inject(TokenService);

  if (!tokenService.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  return tokenService.hasAnyRole('ROLE_MODERATOR', 'ROLE_ADMIN')
    ? true
    : router.parseUrl('/dashboard');
};
