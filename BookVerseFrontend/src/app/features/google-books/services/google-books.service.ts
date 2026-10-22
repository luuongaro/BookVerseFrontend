import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL, authHeaders } from '../../../core/api/api.config';
import { GoogleBooksResponse, SearchType } from '../models/google-book.model';
@Injectable({ providedIn: 'root' })
export class GoogleBooksService {
  private readonly http = inject(HttpClient);
  search(type: SearchType, value: string) {
    return this.http.get<GoogleBooksResponse>(`${API_URL}/google-books/search`, {
      headers: authHeaders(),
      params: { [type]: value.trim() },
    });
  }
}
