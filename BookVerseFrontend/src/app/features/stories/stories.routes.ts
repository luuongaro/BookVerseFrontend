import { Routes } from '@angular/router';
import { MyStories } from './pages/my-stories/my-stories';
import { StoryDetail } from './pages/story-detail/story-detail';
import { StoryForm } from './pages/story-form/story-form';
import { StoryList } from './pages/story-list/story-list';

export const storiesRoutes: Routes = [
  { path: '', component: StoryList },
  { path: 'new', component: StoryForm },
  { path: 'mine', component: MyStories },
  { path: ':id/edit', component: StoryForm },
  { path: ':id', component: StoryDetail },
];