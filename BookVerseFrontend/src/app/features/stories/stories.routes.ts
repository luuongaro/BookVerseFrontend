import { Routes } from '@angular/router';

import { StoryDetail } from './pages/story-detail/story-detail';
import { StoryList } from './pages/story-list/story-list';
import { ChapterList } from './pages/chapter-list/chapter-list';
import { ChapterReader } from './pages/chapter-reader/chapter-reader';

export const storiesRoutes: Routes = [
  { path: '', component: StoryList },

  { path: 'new', redirectTo: '/writer/new', pathMatch: 'full' },
  { path: 'mine', redirectTo: '/writer', pathMatch: 'full' },

  { path: ':id/edit', redirectTo: '/writer/:id/edit', pathMatch: 'full' },

  { path: ':id/chapters/new', redirectTo: '/writer/:id/chapters/new', pathMatch: 'full' },

  {
    path: ':id/chapters/:chapterId/edit',
    redirectTo: '/writer/:id/chapters/:chapterId/edit',
    pathMatch: 'full',
  },

  { path: ':id/chapters/:chapterId', component: ChapterReader },

  { path: ':id/chapters', component: ChapterList },

  { path: ':id', component: StoryDetail },
];
