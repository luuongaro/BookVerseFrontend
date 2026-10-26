import { HttpErrorResponse } from '@angular/common/http';

export const API_URL = 'http://localhost:8080/api';

export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado.';
  }

  switch (error.status) {
    case 0:
      return 'No pudimos conectar con BookVerse. Intentá nuevamente.';
    case 401:
      return 'Tu sesión venció. Volvé a iniciar sesión.';
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
