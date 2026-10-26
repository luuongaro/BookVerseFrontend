import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../core/api/api.config';
import { Book, BookPage } from '../models/book.model';
@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly http = inject(HttpClient);
  getAll(page = 0) {
    return this.http.get<BookPage>(`${API_URL}/books`, {
      params: { page, size: 12 },
    });
  }
  getById(id: string) {
    return this.http.get<Book>(`${API_URL}/books/${encodeURIComponent(id)}`);
  }
  importGoogleBook(id: string) {
    return this.http.post<Book>(
      `${API_URL}/books/google/${encodeURIComponent(id)}`,
      {},
    );
  }
}
