import { Routes } from '@angular/router';
import { GroupList } from './pages/group-list/group-list';
import { GroupDetail } from './pages/group-detail/group-detail';
import { GroupForm } from './pages/group-form/group-form';

export const groupsRoutes: Routes = [
  { path: '', component: GroupList },
  { path: 'new', component: GroupForm },
  { path: ':id/edit', component: GroupForm },
  { path: ':id', component: GroupDetail },
];