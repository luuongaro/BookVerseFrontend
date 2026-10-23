import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BooksService } from './books.service';
import { GoogleBooksService } from '../../google-books/services/google-books.service';
import { ReviewsService } from '../../reviews/services/reviews.service';
import { apiError } from '../../../core/api/api.config';
import { HttpErrorResponse } from '@angular/common/http';

describe('Books, Google Books and reviews API contracts', () => {
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

  it('requests a paginated catalog with the session token', () => {
    TestBed.inject(BooksService).getAll(2).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/books'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('12');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({ content: [], number: 2, totalPages: 3, totalElements: 24 });
  });
  it('sends exactly one trimmed Google search parameter', () => {
    TestBed.inject(GoogleBooksService).search('author', '  Borges  ').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/google-books/search'));
    expect(req.request.params.keys()).toEqual(['author']);
    expect(req.request.params.get('author')).toBe('Borges');
    req.flush({ items: null });
  });
  it('imports a Google volume through BookVerse and returns its local identifier', () => {
    let id = '';
    TestBed.inject(BooksService)
      .importGoogleBook('google/id')
      .subscribe((book) => (id = book.idExternal));
    const req = http.expectOne('http://localhost:8080/api/books/google/google%2Fid');
    expect(req.request.method).toBe('POST');
    req.flush({ idExternal: 'local-book' });
    expect(id).toBe('local-book');
  });
  it('filters reviews by book and by story through their distinct endpoints', () => {
    const service = TestBed.inject(ReviewsService);
    service.getByBook('book-id').subscribe();
    service.getByStory('story-id').subscribe();
    http.expectOne('http://localhost:8080/api/reviews/book/book-id').flush([]);
    http.expectOne('http://localhost:8080/api/reviews/story/story-id').flush([]);
  });
  it('creates a review with one target and updates only editable fields', () => {
    const service = TestBed.inject(ReviewsService);
    const content = { rating: 4, content: 'Una lectura inolvidable.' };
    service
      .create({ ...content, reviewerId: 'user-id', bookId: 'book-id', storyId: null })
      .subscribe();
    const create = http.expectOne('http://localhost:8080/api/reviews');
    expect(create.request.method).toBe('POST');
    expect(create.request.body.storyId).toBeNull();
    create.flush({ reviewId: 'review-id' });
    service.update('review-id', content).subscribe();
    const update = http.expectOne('http://localhost:8080/api/reviews/review-id');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(content);
    update.flush({ reviewId: 'review-id', ...content });
  });
  it('distinguishes session, permission, duplicate and connectivity errors', () => {
    expect(apiError(new HttpErrorResponse({ status: 401 }))).toContain('sesión');
    expect(apiError(new HttpErrorResponse({ status: 403 }))).toContain('permiso');
    expect(apiError(new HttpErrorResponse({ status: 409 }))).toContain('Ya publicaste');
    expect(apiError(new HttpErrorResponse({ status: 0 }))).toContain('conectar');
  });
});
