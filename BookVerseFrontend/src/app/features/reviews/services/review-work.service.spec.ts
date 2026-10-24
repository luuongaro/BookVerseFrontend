import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReviewWorkService } from './review-work.service';
import { Review } from '../models/review.model';
describe('Review work metadata', () => {
  let service: ReviewWorkService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReviewWorkService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads each book only once and uses its categories', () => {
    const review = { bookId: 'book', storyId: null } as Review;
    service.resolveAll([review, review]).subscribe((works) => {
      expect(works).toHaveLength(1);
      expect(works[0].author).toBe('Autora');
      expect(works[0].genres).toEqual(['Fantasía', 'Aventura']);
    });
    http
      .expectOne('http://localhost:8080/api/books/book')
      .flush({ title: 'Libro', authors: ['Autora'], categories: 'Fantasía, Aventura' });
  });
  it('keeps a review visible when its work cannot be fetched', () => {
    service.resolve({ bookId: 'gone' } as Review).subscribe((work) => {
      expect(work.unavailable).toBe(true);
      expect(work.title).toBe('Libro no disponible');
    });
    http
      .expectOne('http://localhost:8080/api/books/gone')
      .flush({}, { status: 404, statusText: 'Not Found' });
  });
  it('resolves story authors and does not invent a genre', () => {
    service.resolve({ bookId: null, storyId: 'story' } as Review).subscribe((work) => {
      expect(work.author).toBe('Escritora');
      expect(work.genres).toEqual([]);
    });
    http
      .expectOne('http://localhost:8080/api/stories/story')
      .flush({ title: 'Historia', authorId: 'author' });
    http.expectOne('http://localhost:8080/api/users/author').flush({ username: 'Escritora' });
  });
});
