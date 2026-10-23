import { booksRoutes } from './features/books/books.routes';
import { reviewsRoutes } from './features/reviews/reviews.routes';
import { GoogleBookSearch } from './features/google-books/pages/google-book-search/google-book-search';
import { Routes } from '@angular/router';
import { Home } from './features/home/pages/home/home';
import { storiesRoutes } from './features/stories/stories.routes';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { Dashboard } from './features/dashboard/pages/dashboard/dashboard';
import { Profile } from './features/profile/pages/profile/profile';
import { groupsRoutes } from './features/groups/groups.routes';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'stories', children: storiesRoutes }, // Registers all story feature routes under the /stories URL prefix
  { path: 'groups', children: groupsRoutes },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard },
  { path: 'profile', component: Profile },
  { path: 'books', children: booksRoutes },
  { path: 'google-books', component: GoogleBookSearch },
  { path: 'reviews', children: reviewsRoutes },
  { path: '**', redirectTo: '' },
];
