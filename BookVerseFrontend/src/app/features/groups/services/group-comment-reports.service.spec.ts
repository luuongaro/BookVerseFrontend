import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GroupCommentReportsService } from './group-comment-reports.service';
import { GroupCommentsService } from './group-comments.service';
import { ReviewReportsService } from '../../reviews/services/review-reports.service';
import { API_URL } from '../../../core/api/api.config';

describe('Moderation API contracts', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('submits and moderates a group comment report', () => {
    const service = TestBed.inject(GroupCommentReportsService);
    const http = TestBed.inject(HttpTestingController);
    service.create('comment', 'Motivo válido', 'Detalle').subscribe();
    const created = http.expectOne(`${API_URL}/group-comment-reports`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ commentId: 'comment', reason: 'Motivo válido', details: 'Detalle' });
    created.flush({ reportId: 'report' });
    service.moderate('report', 'approve', null).subscribe();
    const approve = http.expectOne(`${API_URL}/group-comment-reports/report/approve`);
    expect(approve.request.method).toBe('PATCH');
    expect(approve.request.body).toEqual({ resolutionComment: null });
    approve.flush({});
  });

  it('updates a comment with its reading context and restores a reported review', () => {
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(GroupCommentsService).update('comment', { content: 'Editado', progressType: 'CHAPTER', progressValue: 3 }).subscribe();
    const update = http.expectOne(`${API_URL}/group-comments/comment`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ content: 'Editado', progressType: 'CHAPTER', progressValue: 3 });
    update.flush({});
    TestBed.inject(ReviewReportsService).restore('report').subscribe();
    const restore = http.expectOne(`${API_URL}/review-reports/report/restore`);
    expect(restore.request.method).toBe('PATCH');
    restore.flush(null, { status: 204, statusText: 'No Content' });
  });
});
