import { LibraryService, LibrarySessionError } from '../../../library/services/library.service';
import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { BooksService } from '../../services/books.service';
import { Book } from '../../models/book.model';
@Component({
  selector: 'app-book-detail',
  imports: [RouterLink, ReactiveFormsModule, BookCover],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css',
})
export class BookDetail implements OnInit {
  private readonly service = inject(BooksService);
  private readonly library = inject(LibraryService);
  saving = signal(false);
  saved = signal(false);
  saveError = signal('');
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  book = signal<Book | null>(null);
  loading = signal(true);
  error = signal('');
  private request?: Subscription;
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }
  load(): void {
    this.saved.set(false);
    this.saveError.set('');
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.service
      .getById(this.route.snapshot.paramMap.get('id')!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (book) => {
          this.book.set(book);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
  saveToLibrary(): void {
    const book = this.book();
    if (!book || this.saving() || this.saved()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.library
      .saveBook(book.idExternal)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saved.set(true);
          this.saving.set(false);
        },
        error: (error) => {
          this.saveError.set(
            error instanceof LibrarySessionError ? error.message : apiError(error),
          );
          this.saving.set(false);
        },
      });
  }
}
