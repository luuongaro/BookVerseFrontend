import { Routes } from '@angular/router';
import { BookList } from './pages/book-list/book-list';
import { BookDetail } from './pages/book-detail/book-detail';
export const booksRoutes: Routes = [
  { path: '', component: BookList },
  { path: ':id', component: BookDetail },
];
