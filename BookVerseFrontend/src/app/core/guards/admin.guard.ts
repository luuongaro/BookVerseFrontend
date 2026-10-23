import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  try {
    const token = localStorage.getItem('token');
    if (!token) return router.parseUrl('/login');
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims: { roles?: string[] } = JSON.parse(atob(encoded));
    return claims.roles?.includes('ROLE_ADMIN') ? true : router.parseUrl('/dashboard');
  } catch {
    return router.parseUrl('/login');
  }
};
