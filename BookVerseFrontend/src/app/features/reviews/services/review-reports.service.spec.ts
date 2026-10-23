import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReviewReportsService } from './review-reports.service';

describe('ReviewReportsService API contract', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads pending and all reports from their separate endpoints', () => {
    const service = TestBed.inject(ReviewReportsService);
    service.getPending().subscribe();
    service.getAll().subscribe();
    for (const url of [
      'http://localhost:8080/api/review-reports/pending',
      'http://localhost:8080/api/review-reports',
    ]) {
      const request = http.expectOne(url);
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
      request.flush([]);
    }
  });

  it('creates reports and moderates them with PATCH and the backend DTO fields', () => {
    const service = TestBed.inject(ReviewReportsService);
    const createDto = {
      reviewId: 'review-id',
      reporterUserId: 'user-id',
      reason: 'Contenido inapropiado',
      details: null,
    };
    service.create(createDto).subscribe();
    const create = http.expectOne('http://localhost:8080/api/review-reports');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(createDto);
    create.flush({ reportId: 'report-id' });

    service.approve('report-id', { resolutionComment: 'Revisado' }).subscribe();
    const approve = http.expectOne('http://localhost:8080/api/review-reports/report-id/approve');
    expect(approve.request.method).toBe('PATCH');
    expect(approve.request.body).toEqual({ resolutionComment: 'Revisado' });
    approve.flush({ reportId: 'report-id', status: 'APPROVED' });

    service.reject('report-id', { resolutionComment: null }).subscribe();
    const reject = http.expectOne('http://localhost:8080/api/review-reports/report-id/reject');
    expect(reject.request.method).toBe('PATCH');
    expect(reject.request.body).toEqual({ resolutionComment: null });
    reject.flush({ reportId: 'report-id', status: 'REJECTED' });
  });
});
