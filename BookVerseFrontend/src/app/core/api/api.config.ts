import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const API_URL = environment.apiUrl;

export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado.';
  }

  const body = error.error as { message?: unknown } | string | null;
  const message = typeof body === 'string' ? body : body?.message;
  if (typeof message === 'string' && message.trim()) {
    if (message.trim() === 'The user has already reviewed this book') {
      return 'Ya publicaste una reseña para este libro.';
    }
    return message.trim();
  }

  switch (error.status) {
    case 0:
      return 'No pudimos conectar con BookVerse. Intentá nuevamente.';
    case 401:
      return 'Tu sesión venció. Iniciá sesión para continuar.';
    case 403:
      return 'No tenés permiso para realizar esta operación.';
    case 404:
      return 'No encontramos el recurso solicitado.';
    case 409:
      return 'Ya publicaste una reseña para esta obra.';
    case 400:
      return 'Revisá los datos ingresados e intentá nuevamente.';
    default:
      return 'No pudimos completar la operación. Intentá nuevamente.';
  }
}
