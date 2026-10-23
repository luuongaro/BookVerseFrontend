import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

function sessionRoles(): string[] | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims: { roles?: string[] } = JSON.parse(atob(encoded));
    return Array.isArray(claims.roles) ? claims.roles : [];
  } catch {
    return null;
  }
}

export const authenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);
  return sessionRoles() ? true : router.parseUrl('/login');
};

export const moderatorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const roles = sessionRoles();
  if (!roles) return router.parseUrl('/login');
  return roles.some((role) => role === 'ROLE_MODERATOR' || role === 'ROLE_ADMIN')
    ? true
    : router.parseUrl('/dashboard');
};
