import { Routes } from '@angular/router';
import { WriterDesk } from './pages/writer-desk/writer-desk';
import { StoryDetail } from './pages/story-detail/story-detail';
import { StoryForm } from './pages/story-form/story-form';
import { ChapterList } from './pages/chapter-list/chapter-list';
import { ChapterForm } from './pages/chapter-form/chapter-form';
import { ChapterReader } from './pages/chapter-reader/chapter-reader';

export const writerRoutes: Routes = [
  { path: '', component: WriterDesk },
  { path: 'new', component: StoryForm },
  { path: ':id/edit', component: StoryForm },
  { path: ':id/chapters/new', component: ChapterForm },
  { path: ':id/chapters/:chapterId/edit', component: ChapterForm },
  { path: ':id/chapters/:chapterId', component: ChapterReader, data: { writing: true } },
  { path: ':id/chapters', component: ChapterList, data: { writing: true } },
  { path: ':id', component: StoryDetail, data: { writing: true } },
];
