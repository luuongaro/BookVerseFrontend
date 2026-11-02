import { Routes } from '@angular/router';
import { WriterDesk } from './pages/writer-desk/writer-desk';
import { StoryForm } from './pages/story-form/story-form';
import { ChapterForm } from './pages/chapter-form/chapter-form';
import { ChapterReader } from './pages/chapter-reader/chapter-reader';

export const writerRoutes: Routes = [
  { path: '', component: WriterDesk },
  { path: 'new', component: StoryForm },
  { path: ':id/edit', component: StoryForm },
  { path: ':id/chapters/new', component: ChapterForm },
  { path: ':id/chapters/:chapterId/edit', component: ChapterForm },
  { path: ':id/chapters/:chapterId', component: ChapterReader, data: { writing: true } },
];
