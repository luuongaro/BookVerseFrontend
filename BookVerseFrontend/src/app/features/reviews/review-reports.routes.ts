import { Routes } from '@angular/router';
import { ReviewReportList } from './pages/report-list/report-list';
import { ReviewReportDetail } from './pages/report-detail/report-detail';
import { ReviewReportForm } from './pages/report-form/report-form';
import { authenticatedGuard, moderatorGuard } from '../../core/guards/session-role.guard';

export const reviewReportsRoutes: Routes = [
  { path: '', component: ReviewReportList, canActivate: [moderatorGuard] },
  { path: 'new', component: ReviewReportForm, canActivate: [authenticatedGuard] },
  { path: ':id', component: ReviewReportDetail, canActivate: [moderatorGuard] },
];
