import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const tokenService = inject(TokenService);

  if (!tokenService.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  return tokenService.hasAnyRole('ROLE_ADMIN')
    ? true
    : router.parseUrl('/dashboard');
};
