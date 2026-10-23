import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LibraryService, LibrarySessionError } from './library.service';
import { LibraryResult, ReadingStatus } from '../models/library-book.model';
const userId = '11111111-1111-4111-8111-111111111111';
const status = {
  idExternal: 'reading-id',
  userId,
  bookId: 'saved-book',
  storyId: null,
  status: 'IN_PROGRESS',
  progressType: 'PERCENTAGE',
  progressValue: 40,
  startedAt: null,
  finishedAt: null,
  updatedAt: null,
} as ReadingStatus;
describe('Personal library API', () => {
  let service: LibraryService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LibraryService);
    http = TestBed.inject(HttpTestingController);
    localStorage.setItem('userId', userId);
    localStorage.setItem('token', 'session-token');
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });
  it('requests only the current user statuses and does not use the global catalog', () => {
    let result: LibraryResult | undefined;
    service.getMyBooks().subscribe((value) => (result = value));
    const req = http.expectOne('http://localhost:8080/api/reading-statuses/user/' + userId);
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush([
      status,
      { ...status, idExternal: 'story-status', bookId: null, storyId: 'story-id' },
      { ...status, userId: 'another-user', bookId: 'private-book' },
    ]);
    http
      .expectOne('http://localhost:8080/api/books/saved-book')
      .flush({ idExternal: 'saved-book', title: 'Saved book', authors: [] });
    http.expectNone('http://localhost:8080/api/books');
    http.expectNone('http://localhost:8080/api/books/private-book');
    expect(result?.entries.map((entry) => entry.book.idExternal)).toEqual(['saved-book']);
  });
  it('keeps an empty library empty instead of loading everyone’s books', () => {
    let result: LibraryResult | undefined;
    service.getMyBooks().subscribe((value) => (result = value));
    http.expectOne('http://localhost:8080/api/reading-statuses/user/' + userId).flush([]);
    expect(result).toEqual({ entries: [], unavailableCount: 0 });
    http.expectNone((req) => req.url.includes('/api/books'));
  });
  it('does not request any library without session identity', () => {
    localStorage.removeItem('userId');
    let error: unknown;
    service.getMyBooks().subscribe({ error: (value) => (error = value) });
    expect(error).toBeInstanceOf(LibrarySessionError);
    http.expectNone(() => true);
  });
  it('preserves existing status and progress when saving an already saved book', () => {
    let result: ReadingStatus | undefined;
    service.saveBook('saved-book').subscribe((value) => (result = value));
    http.expectOne('http://localhost:8080/api/reading-statuses/user/' + userId).flush([status]);
    http.expectNone((req) => req.method === 'POST' || req.method === 'PUT');
    expect(result?.status).toBe('IN_PROGRESS');
    expect(result?.progressValue).toBe(40);
  });
  it('saves a new book for the authenticated user as WANT_TO_READ without inventing progress', () => {
    service.saveBook('new-book').subscribe();
    http.expectOne('http://localhost:8080/api/reading-statuses/user/' + userId).flush([]);
    const req = http.expectOne('http://localhost:8080/api/reading-statuses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      bookId: 'new-book',
      storyId: null,
      status: 'WANT_TO_READ',
      startedAt: null,
      finishedAt: null,
      progressType: null,
      progressValue: null,
    });
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush({ ...status, bookId: 'new-book', status: 'WANT_TO_READ' });
  });
  it('continues showing available saved books when one was removed from the catalog', () => {
    let result: LibraryResult | undefined;
    service.getMyBooks().subscribe((value) => (result = value));
    http
      .expectOne('http://localhost:8080/api/reading-statuses/user/' + userId)
      .flush([status, { ...status, bookId: 'gone-book' }]);
    http
      .expectOne('http://localhost:8080/api/books/saved-book')
      .flush({ idExternal: 'saved-book', title: 'Saved book' });
    http
      .expectOne('http://localhost:8080/api/books/gone-book')
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(result?.entries).toHaveLength(1);
    expect(result?.unavailableCount).toBe(1);
  });
  it('reports a permission error rather than treating it as an empty personal shelf', () => {
    let error: { status: number } | undefined;
    service.getMyBooks().subscribe({ error: (value) => (error = value) });
    http.expectOne('http://localhost:8080/api/reading-statuses/user/' + userId).flush([status]);
    http
      .expectOne('http://localhost:8080/api/books/saved-book')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(error?.status).toBe(403);
  });
});
