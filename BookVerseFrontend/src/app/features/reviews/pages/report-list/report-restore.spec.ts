import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ReviewReportList } from './report-list';
import { ReviewReportsService } from '../../services/review-reports.service';
import { StoryReportsService } from '../../services/story-reports.service';
import { ReviewReport } from '../../models/review-report.model';

describe('Restoring a moderated review', () => {
  const report = { reportId: 'report', reviewId: 'review', status: 'APPROVED', resolutionComment: null } as ReviewReport;
  it('restores an approved review once and shows confirmation', () => {
    const pending = new Subject<void>();
    const service = { restore: vi.fn(() => pending), getAll: () => of([]) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ReviewReportsService, useValue: service }, { provide: StoryReportsService, useValue: {} }] });
    const component = TestBed.createComponent(ReviewReportList).componentInstance;
    component.openReport(report);
    component.restoreReview();
    component.restoreReview();
    expect(service.restore).toHaveBeenCalledExactlyOnceWith('report');
    pending.next(); pending.complete();
    expect(component.restoredReports().has('report')).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('keeps the report available when restoration fails', () => {
    const service = { restore: vi.fn(() => throwError(() => new Error('offline'))) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ReviewReportsService, useValue: service }, { provide: StoryReportsService, useValue: {} }] });
    const component = TestBed.createComponent(ReviewReportList).componentInstance;
    component.openReport(report);
    component.restoreReview();
    expect(component.selectedReport()?.reportId).toBe('report');
    expect(component.actionError()).toContain('No se pudo');
    expect(component.saving()).toBe(false);
  });
});
