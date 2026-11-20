import { Injectable } from '@angular/core';
import { Review } from '../models/review.model';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable({ providedIn: 'root' })
export class ReviewSessionService {
  // Login stores the external user UUID alongside the token.
  // JWT sub contains the email and must not be used as a UUID.
  userId(): string | null {
    const id = localStorage.getItem('userId');
    return id && UUID_PATTERN.test(id) ? id : null;
  }
  canEdit(review: Review): boolean {
    return this.userId() === review.reviewerId;
  }
}
