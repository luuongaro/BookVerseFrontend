import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api/api.config';
import { TokenService } from '../services/token.service';
import { SessionExpiredService } from '../services/session-expired.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const isBookVerseApiRequest =
    request.url === API_URL || request.url.startsWith(`${API_URL}/`);

  const isAuthRequest = request.url.startsWith(`${API_URL}/auth/`);

  if (!isBookVerseApiRequest || isAuthRequest) {
    return next(request);
  }

  const tokenService = inject(TokenService);
  const token = tokenService.getToken();
  const router = inject(Router);
  const sessionExpired = inject(SessionExpiredService);

  const currentPath = router.url.split('?')[0];
  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ];
  const isPrivateRoute = !publicPaths.includes(currentPath);

  const authenticatedRequest = token
    ? request.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const hasSession = Boolean(token) || tokenService.hasStoredToken();

      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isPrivateRoute &&
        hasSession
      ) {
        sessionExpired.show(router.url);
      }

      return throwError(() => error);
    }),
  );
};
