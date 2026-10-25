import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';
import { API_URL, authHeaders } from '../../../core/api/api.config';
@Injectable({ providedIn: 'root' })
export class ReviewReadersService {
  private readonly http = inject(HttpClient);
  resolve(ids: string[]) {
    const unique = [...new Set(ids)];
    return unique.length
      ? forkJoin(
          unique.map((id) =>
            this.http
              .get<{ username: string }>(`${API_URL}/users/${encodeURIComponent(id)}`, {
                headers: authHeaders(),
              })
              .pipe(
                map((user) => [id, user.username] as const),
                catchError(() => of([id, 'Lector de BookVerse'] as const)),
              ),
          ),
        ).pipe(map((entries) => Object.fromEntries(entries) as Record<string, string>))
      : of({} as Record<string, string>);
  }
}
