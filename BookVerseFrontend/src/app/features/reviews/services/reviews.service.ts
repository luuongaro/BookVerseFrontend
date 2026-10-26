import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../core/api/api.config';
import { Review, CreateReview, ReviewContent } from '../models/review.model';
@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  getAll() {
    return this.http.get<Review[]>(`${API_URL}/reviews`);
  }
  getByBook(id: string) {
    return this.http.get<Review[]>(`${API_URL}/reviews/book/${encodeURIComponent(id)}`);
  }
  getByStory(id: string) {
    return this.http.get<Review[]>(`${API_URL}/reviews/story/${encodeURIComponent(id)}`);
  }
  getById(id: string) {
    return this.http.get<Review>(`${API_URL}/reviews/${encodeURIComponent(id)}`);
  }
  create(request: CreateReview) {
    return this.http.post<Review>(`${API_URL}/reviews`, request);
  }
  update(id: string, request: ReviewContent) {
    return this.http.put<Review>(`${API_URL}/reviews/${encodeURIComponent(id)}`, request);
  }
}
