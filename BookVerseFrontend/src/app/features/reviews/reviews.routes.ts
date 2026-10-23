import { Routes } from '@angular/router';
import { ReviewList } from './pages/review-list/review-list';
import { ReviewDetail } from './pages/review-detail/review-detail';
export const reviewsRoutes: Routes = [
  { path: '', component: ReviewList },
  { path: ':id', component: ReviewDetail },
];
