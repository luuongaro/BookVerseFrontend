import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { CommentReports } from './comment-reports';
import { GroupCommentReportsService, GroupCommentReport } from '../../../groups/services/group-comment-reports.service';

describe('Comment moderation', () => {
  const report: GroupCommentReport = { reportId: 'report', commentId: 'comment', groupId: 'group', commentAuthorUsername: 'Ana', commentContent: 'Texto', reporterUsername: 'Lu', reason: 'Motivo', details: null, resolutionComment: null, status: 'PENDING', createdAt: '2026-11-13' };

  it('filters reports and prevents submitting the same decision twice', () => {
    const pending = new Subject<GroupCommentReport>();
    const service = { getAll: vi.fn(() => of([report])), moderate: vi.fn(() => pending) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: GroupCommentReportsService, useValue: service }] });
    const fixture = TestBed.createComponent(CommentReports);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.filteredReports()).toHaveLength(1);
    component.filter.set('APPROVED');
    expect(component.filteredReports()).toHaveLength(0);
    component.open(report);
    component.resolution = ' Revisado ';
    component.moderate('approve');
    component.moderate('approve');
    expect(service.moderate).toHaveBeenCalledExactlyOnceWith('report', 'approve', 'Revisado');
    pending.next({ ...report, status: 'APPROVED' });
    pending.complete();
    expect(component.busy()).toBe(false);
    expect(component.selected()).toBeNull();
  });

  it('keeps the report open when moderation fails', () => {
    const service = { getAll: () => of([report]), moderate: () => throwError(() => new Error('offline')) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: GroupCommentReportsService, useValue: service }] });
    const component = TestBed.createComponent(CommentReports).componentInstance;
    component.open(report);
    component.moderate('reject');
    expect(component.selected()?.reportId).toBe('report');
    expect(component.error()).toContain('No pudimos');
  });
});
