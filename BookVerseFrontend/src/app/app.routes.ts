import { Routes } from '@angular/router';
import { Home } from './features/home/pages/home/home';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { Dashboard } from './features/dashboard/pages/dashboard/dashboard';
import { Profile } from './features/profile/pages/profile/profile';
import { MyLibrary } from './features/library/pages/my-library/my-library';
import { GoogleBookSearch } from './features/google-books/pages/google-book-search/google-book-search';
import { RoleManagement } from './features/roles/pages/role-management/role-management';
import { booksRoutes } from './features/books/books.routes';
import { groupsRoutes } from './features/groups/groups.routes';
import { reviewsRoutes } from './features/reviews/reviews.routes';
import { reviewReportsRoutes } from './features/reviews/review-reports.routes';
import { storiesRoutes } from './features/stories/stories.routes';
import { adminGuard } from './core/guards/admin.guard';
import { authenticatedGuard } from './core/guards/session-role.guard';
import { AuthenticatedLayout } from './shared/components/authenticated-layout/authenticated-layout';

export const routes: Routes = [
  { path: '', component: Home, pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  {
    path: '',
    component: AuthenticatedLayout,
    canActivate: [authenticatedGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'profile', component: Profile },
      { path: 'library', component: MyLibrary },
      { path: 'stories', children: storiesRoutes },
      { path: 'groups', children: groupsRoutes },
      { path: 'books', children: booksRoutes },
      { path: 'google-books', component: GoogleBookSearch },
      { path: 'reviews', children: reviewsRoutes },
      { path: 'review-reports', children: reviewReportsRoutes },
      {
        path: 'role-management',
        component: RoleManagement,
        canActivate: [adminGuard],
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
