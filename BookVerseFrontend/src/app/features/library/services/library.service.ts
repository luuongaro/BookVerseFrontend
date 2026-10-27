import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { API_URL } from '../../../core/api/api.config';
import { BooksService } from '../../books/services/books.service';
import {
  LibraryBook,
  LibraryResult,
  ReadingStatus,
  ReadingState,
} from '../models/library-book.model';
export class LibrarySessionError extends Error {
  constructor() {
    super('Volvé a iniciar sesión para acceder a tu biblioteca.');
  }
}
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly books = inject(BooksService);
  getMyStatuses(): Observable<ReadingStatus[]> {
    const userId = localStorage.getItem('userId');
    if (!userId) return throwError(() => new LibrarySessionError());
    return this.http
      .get<ReadingStatus[]>(`${API_URL}/reading-statuses/user/${encodeURIComponent(userId)}`)
      .pipe(map((statuses) => statuses.filter((status) => status.userId === userId)));
  }
  getBookStatus(bookId: string): Observable<ReadingStatus | null> {
    return this.getMyStatuses().pipe(
      map((statuses) => statuses.find((status) => status.bookId === bookId) ?? null),
    );
  }
  getMyBooks(): Observable<LibraryResult> {
    return this.getMyStatuses().pipe(
      switchMap((statuses) => {
        const saved = statuses.filter((status) => status.bookId !== null);
        if (saved.length === 0) return of({ entries: [], unavailableCount: 0 });
        return forkJoin(
          saved.map((reading) =>
            this.books.getById(reading.bookId!).pipe(
              map((book) => ({ book, reading }) as LibraryBook | null),
              catchError((error) =>
                error instanceof HttpErrorResponse && error.status === 404
                  ? of(null)
                  : throwError(() => error),
              ),
            ),
          ),
        ).pipe(
          map((results) => ({
            entries: results.filter((entry): entry is LibraryBook => entry !== null),
            unavailableCount: results.filter((entry) => entry === null).length,
          })),
        );
      }),
    );
  }
  updateStatus(
    reading: ReadingStatus,
    status: ReadingState,
    percentage?: number | null,
  ): Observable<ReadingStatus> {
    const userId = localStorage.getItem('userId');
    if (!userId || reading.userId !== userId) return throwError(() => new LibrarySessionError());
    if (percentage != null && percentage > 0 && status !== 'IN_PROGRESS' && status !== 'RE_READING')
      return throwError(
        () => new RangeError('El porcentaje solo se puede cargar en Leyendo o Releyendo.'),
      );
    if (percentage != null && (!Number.isInteger(percentage) || percentage < 0 || percentage > 100))
      return throwError(() => new RangeError('Ingresá un porcentaje entero entre 0 y 100.'));
    const progress =
      percentage === undefined
        ? { progressType: reading.progressType, progressValue: reading.progressValue }
        : percentage === null || percentage === 0
          ? { progressType: null, progressValue: null }
          : { progressType: 'PERCENTAGE', progressValue: percentage };
    return this.http.put<ReadingStatus>(
      `${API_URL}/reading-statuses/${encodeURIComponent(reading.idExternal)}`,
      {
        bookId: reading.bookId,
        storyId: reading.storyId,
        status,
        startedAt: reading.startedAt,
        finishedAt: reading.finishedAt,
        ...progress,
      },
    );
  }
  saveBook(bookId: string): Observable<ReadingStatus> {
    // Importing a Google volume into the shared catalog does not save it for a user.
    return this.getBookStatus(bookId).pipe(
      switchMap((existing) =>
        existing
          ? of(existing)
          : this.http.post<ReadingStatus>(`${API_URL}/reading-statuses`, {
              bookId,
              storyId: null,
              status: 'WANT_TO_READ',
              startedAt: null,
              finishedAt: null,
              progressType: null,
              progressValue: null,
            }),
      ),
    );
  }
}
