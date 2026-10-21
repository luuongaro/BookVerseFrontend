import { Routes } from '@angular/router';
import { Home } from './features/home/pages/home/home';
import { storiesRoutes } from './features/stories/stories.routes';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'stories', children: storiesRoutes }, // Registers all story feature routes under the /stories URL prefix
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: '**', redirectTo: '' },
];