import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { CatalogNav } from '../../../../shared/components/catalog-nav/catalog-nav';
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/http/api';
import { BooksService } from '../../services/books.service';
import { BookPage } from '../../models/book.model';
@Component({
  selector: 'app-book-list',
  imports: [RouterLink, ReactiveFormsModule, CatalogNav, BookCover],
  templateUrl: './book-list.html',
  styleUrl: './book-list.css',
})
export class BookList implements OnInit {
  private readonly service = inject(BooksService);
  result = signal<BookPage | null>(null);
  loading = signal(false);
  error = signal('');
  ngOnInit(): void {
    this.load();
  }
  load(page = 0): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.service.getAll(page).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }
}
