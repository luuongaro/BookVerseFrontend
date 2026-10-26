import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { API_URL } from '../api/api.config';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const isBookVerseApiRequest =
    request.url === API_URL || request.url.startsWith(`${API_URL}/`);

  const isAuthRequest = request.url.startsWith(`${API_URL}/auth/`);

  if (!isBookVerseApiRequest || isAuthRequest) {
    return next(request);
  }

  const token = inject(TokenService).getToken();

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
