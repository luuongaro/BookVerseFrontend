import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CatalogNav } from '../../../../shared/components/catalog-nav/catalog-nav';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/http/api';
import { BooksService } from '../../services/books.service';
import { Book } from '../../models/book.model';
@Component({
  selector: 'app-book-detail',
  imports: [RouterLink, ReactiveFormsModule, CatalogNav, BookCover],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css',
})
export class BookDetail implements OnInit {
  private readonly service = inject(BooksService);
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
}
