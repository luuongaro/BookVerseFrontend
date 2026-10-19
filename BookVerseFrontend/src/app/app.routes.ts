import { Routes } from '@angular/router';
import { Home } from './features/home/pages/home/home';
import { storiesRoutes } from './features/stories/stories.routes';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'stories', children: storiesRoutes }, // Registers all story feature routes under the /stories URL prefix
  { path: '**', redirectTo: '' },
];