import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';
import { BooksService } from '../../books/services/books.service';
import { Review } from '../models/review.model';

type StoryCoverTheme = 'moon' | 'stars' | 'rose' | 'teal' | 'gold';

const STORY_COVERS: {
  theme: StoryCoverTheme;
  symbol: string;
}[] = [
  { theme: 'moon', symbol: '☾' },
  { theme: 'stars', symbol: '✦' },
  { theme: 'rose', symbol: '✧' },
  { theme: 'teal', symbol: '☽' },
  { theme: 'gold', symbol: '✺' },
];

export function storyCoverFor(id: string) {
  const seed = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return STORY_COVERS[seed % STORY_COVERS.length];
}

export interface ReviewWork {
  key: string;
  id: string;
  kind: 'book' | 'story';
  title: string;
  author: string;
  authorId?: string | null;
  genres: string[];
  unavailable: boolean;
  coverUrl?: string | null;
  coverTheme?: StoryCoverTheme;
  coverSymbol?: string;
}
@Injectable({ providedIn: 'root' })
export class ReviewWorkService {
  private readonly books = inject(BooksService);
  private readonly http = inject(HttpClient);
  resolve(review: Pick<Review, 'bookId' | 'storyId'>): Observable<ReviewWork> {
    const kind = review.bookId ? 'book' : 'story';
    const id = review.bookId ?? review.storyId ?? '';
    const storyCover = kind === 'story' ? storyCoverFor(id) : null;
    const fallback: ReviewWork = {
      key: `${kind}:${id}`,
      id,
      kind,
      title: kind === 'book' ? 'Libro no disponible' : 'Historia no disponible',
      author: 'Autor no disponible',
      authorId: null,
      genres: [],
      unavailable: true,
      coverTheme: storyCover?.theme,
      coverSymbol: storyCover?.symbol,
    };
    if (!id) return of(fallback);
    if (kind === 'book')
      return this.books.getById(id).pipe(
        map((book) => ({
          ...fallback,
          title: book.title,
          coverUrl: book.thumbnailUrl,
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
      .get<{ title: string; authorUsername: string; authorId?: string }>(
        `${API_URL}/stories/${encodeURIComponent(id)}`,
      )
      .pipe(
        map((story) => ({
          ...fallback,
          title: story.title,
          author: story.authorUsername?.trim() || 'Autor desconocido',
          authorId: story.authorId ?? null,
          unavailable: false,
        })),
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
