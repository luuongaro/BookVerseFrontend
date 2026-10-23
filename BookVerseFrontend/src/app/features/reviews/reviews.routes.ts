import { Routes } from '@angular/router';
import { ReviewList } from './pages/review-list/review-list';
import { ReviewDetail } from './pages/review-detail/review-detail';
import { ReviewForm } from './pages/review-form/review-form';
export const reviewsRoutes: Routes = [
  { path: '', component: ReviewList },
  { path: 'new', component: ReviewForm },
  { path: ':id/edit', component: ReviewForm },
  { path: ':id', component: ReviewDetail },
];
