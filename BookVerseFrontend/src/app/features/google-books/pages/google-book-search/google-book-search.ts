import { switchMap } from 'rxjs';
import { LibraryService, LibrarySessionError } from '../../../library/services/library.service';
import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { CatalogNav } from '../../../../shared/components/catalog-nav/catalog-nav';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { GoogleBooksService } from '../../services/google-books.service';
import { GoogleBook, SearchType } from '../../models/google-book.model';
import { BooksService } from '../../../books/services/books.service';
import { HttpErrorResponse } from '@angular/common/http';
@Component({
  selector: 'app-google-book-search',
  imports: [ReactiveFormsModule, CatalogNav, BookCover],
  templateUrl: './google-book-search.html',
  styleUrl: './google-book-search.css',
})
export class GoogleBookSearch {
  private readonly service = inject(GoogleBooksService);
  private readonly books = inject(BooksService);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    type: ['query' as SearchType],
    value: ['', Validators.required],
  });
  results = signal<GoogleBook[]>([]);
  loading = signal(false);
  searched = signal(false);
  error = signal('');
  importing = signal('');
  importError = signal('');
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
    this.results.set([]);
    this.searched.set(true);
    this.service.search(type, value).subscribe({
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
    if (this.importing()) return;
    this.importing.set(id);
    this.importError.set('');
    this.books
      .importGoogleBook(id)
      .pipe(switchMap((book) => this.library.saveBook(book.idExternal)))
      .subscribe({
        next: () => {
          this.importing.set('');
          void this.router.navigate(['/library']);
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
