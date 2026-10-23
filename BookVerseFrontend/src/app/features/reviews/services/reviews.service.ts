import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL, authHeaders } from '../../../core/api/api.config';
import { Review, CreateReview, ReviewContent } from '../models/review.model';
@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  getAll() {
    return this.http.get<Review[]>(`${API_URL}/reviews`, { headers: authHeaders() });
  }
  getByBook(id: string) {
    return this.http.get<Review[]>(`${API_URL}/reviews/book/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    });
  }
  getByStory(id: string) {
    return this.http.get<Review[]>(`${API_URL}/reviews/story/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    });
  }
  getById(id: string) {
    return this.http.get<Review>(`${API_URL}/reviews/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    });
  }
  create(request: CreateReview) {
    return this.http.post<Review>(`${API_URL}/reviews`, request, { headers: authHeaders() });
  }
  update(id: string, request: ReviewContent) {
    return this.http.put<Review>(`${API_URL}/reviews/${encodeURIComponent(id)}`, request, {
      headers: authHeaders(),
    });
  }
}
