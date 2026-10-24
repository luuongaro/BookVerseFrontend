import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { API_URL, authHeaders } from '../../../core/api/api.config';
import { BooksService } from '../../books/services/books.service';
import { Review } from '../models/review.model';
export interface ReviewWork {
  key: string;
  id: string;
  kind: 'book' | 'story';
  title: string;
  author: string;
  genres: string[];
  unavailable: boolean;
}
@Injectable({ providedIn: 'root' })
export class ReviewWorkService {
  private readonly books = inject(BooksService);
  private readonly http = inject(HttpClient);
  resolve(review: Review): Observable<ReviewWork> {
    const kind = review.bookId ? 'book' : 'story';
    const id = review.bookId ?? review.storyId ?? '';
    const fallback: ReviewWork = {
      key: `${kind}:${id}`,
      id,
      kind,
      title: kind === 'book' ? 'Libro no disponible' : 'Historia no disponible',
      author: 'Autor no disponible',
      genres: [],
      unavailable: true,
    };
    if (!id) return of(fallback);
    if (kind === 'book')
      return this.books.getById(id).pipe(
        map((book) => ({
          ...fallback,
          title: book.title,
          author: book.authors?.join(', ') || 'Autor desconocido',
          genres:
            book.categories
              ?.split(/[,;]/)
              .map((value) => value.trim())
              .filter(Boolean) ?? [],
          unavailable: false,
        })),
        catchError(() => of(fallback)),
      );
    return this.http
      .get<{ title: string; authorId: string }>(`${API_URL}/stories/${encodeURIComponent(id)}`, {
        headers: authHeaders(),
      })
      .pipe(
        switchMap((story) =>
          this.http
            .get<{ username: string }>(`${API_URL}/users/${encodeURIComponent(story.authorId)}`, {
              headers: authHeaders(),
            })
            .pipe(
              map((user) => ({
                ...fallback,
                title: story.title,
                author: user.username,
                unavailable: false,
              })),
              catchError(() => of({ ...fallback, title: story.title, unavailable: false })),
            ),
        ),
        catchError(() => of(fallback)),
      );
  }
  resolveAll(reviews: Review[]): Observable<ReviewWork[]> {
    const unique = [
      ...new Map(
        reviews.map((review) => [
          review.bookId ? `book:${review.bookId}` : `story:${review.storyId}`,
          review,
        ]),
      ).values(),
    ];
    return unique.length ? forkJoin(unique.map((review) => this.resolve(review))) : of([]);
  }
}
