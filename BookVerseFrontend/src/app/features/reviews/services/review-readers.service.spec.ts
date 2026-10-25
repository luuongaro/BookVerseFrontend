import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReviewReadersService } from './review-readers.service';
describe('Review reader names', () => {
  it('requests each reader once and preserves cards when a profile is unavailable', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(ReviewReadersService)
      .resolve(['reader', 'reader', 'unavailable'])
      .subscribe((names) => {
        expect(names['reader']).toBe('Alex');
        expect(names['unavailable']).toBe('Lector de BookVerse');
      });
    http.expectOne('http://localhost:8080/api/users/reader').flush({ username: 'Alex' });
    http
      .expectOne('http://localhost:8080/api/users/unavailable')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    http.verify();
  });
});
