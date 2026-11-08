import { forkJoin, switchMap } from 'rxjs';
import { LibraryService, LibrarySessionError } from '../../../library/services/library.service';
import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { GoogleBooksService } from '../../services/google-books.service';
import { GoogleBook, SearchType } from '../../models/google-book.model';
import { BooksService } from '../../../books/services/books.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ReadingState } from '../../../library/models/library-book.model';
import { ReadingStateSelect } from '../../../library/components/reading-state-select/reading-state-select';
@Component({
  selector: 'app-google-book-search',
  imports: [ReactiveFormsModule, BookCover, ReadingStateSelect],
  templateUrl: './google-book-search.html',
  styleUrl: './google-book-search.css',
})
export class GoogleBookSearch {
  private readonly service = inject(GoogleBooksService);
  private readonly books = inject(BooksService);
  private readonly library = inject(LibraryService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  form = this.fb.nonNullable.group({
    type: ['title' as SearchType],
    value: ['', Validators.required],
  });
  results = signal<GoogleBook[]>([]);
  loading = signal(false);
  searched = signal(false);
  error = signal('');
  importing = signal('');
  importError = signal('');
  confirmation = signal('');
  selectedBook = signal<GoogleBook | null>(null);
  readonly selectedStates = signal<Record<string, ReadingState>>({});
  readonly savedBookIds = signal<Set<string>>(new Set());
  stateFor(id: string): ReadingState {
    return this.selectedStates()[id] ?? 'WANT_TO_READ';
  }
  chooseState(id: string, state: ReadingState): void {
    if (!this.importing()) this.selectedStates.update((states) => ({ ...states, [id]: state }));
  }
  preview(book: GoogleBook): void {
    this.selectedBook.set(book);
  }
  closePreview(): void {
    this.selectedBook.set(null);
  }
  search(): void {
    if (this.loading() || this.importing()) return;
    const { type, value } = this.form.getRawValue();
    if (!value.trim()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.importError.set('');
    this.confirmation.set('');
    this.results.set([]);
    this.closePreview();
    this.selectedStates.set({});
    this.savedBookIds.set(new Set());
    this.searched.set(true);
    this.service
      .search(type, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.results.set(response.items ?? []);
          this.loading.set(false);
        },
        error: (error) => {
          if (!(error instanceof HttpErrorResponse && error.status === 404))
            this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
  importBook(id: string): void {
    if (this.importing() || this.savedBookIds().has(id)) return;
    const state = this.stateFor(id);
    this.importing.set(id);
    this.importError.set('');
    this.confirmation.set('');
    forkJoin({
      book: this.books.importGoogleBook(id),
      statuses: this.library.getMyStatuses(),
    })
      .pipe(
        switchMap(({ book, statuses }) =>
          this.library.saveBookWithKnownStatuses(book.idExternal, state, statuses),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.savedBookIds.update((ids) => new Set(ids).add(id));
          this.importing.set('');
          this.importError.set('');
          this.confirmation.set('Libro agregado a tu biblioteca. Podés seguir agregando más.');
        },
        error: (error) => {
          this.importError.set(
            error instanceof LibrarySessionError ? error.message : apiError(error),
          );
          this.importing.set('');
        },
      });
  }
}
