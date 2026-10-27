import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReviewForm } from './review-form';
import { ReviewsService } from '../../services/reviews.service';
import { BooksService } from '../../../books/services/books.service';
import { ReviewSessionService } from '../../services/review-session.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Review } from '../../models/review.model';
import { ReviewWorkService } from '../../services/review-work.service';

const userId = '11111111-1111-4111-8111-111111111111';
const bookId = '22222222-2222-4222-8222-222222222222';
const storyId = '33333333-3333-4333-8333-333333333333';
describe('ReviewForm rules', () => {
  function setup(edit = false, owner = true, story = false) {
    const review = {
      reviewId: 'review-id',
      reviewerId: owner ? userId : 'other',
      bookId: story ? null : bookId,
      storyId: story ? storyId : null,
      rating: 3,
      content: 'Una gran lectura.',
    } as Review;
    const service = {
      getById: vi.fn(() => of(review)),
      create: vi.fn(() => of(review)),
      update: vi.fn(() => of(review)),
    };
    const navigate = vi.fn();
    const work = {
      id: story ? storyId : bookId,
      key: story ? `story:${storyId}` : `book:${bookId}`,
      kind: story ? ('story' as const) : ('book' as const),
      title: story ? 'Historia de prueba' : 'Libro de prueba',
      author: 'Autora de prueba',
      unavailable: false,
      genres: [],
    };
    const resolve = vi.fn(() => of(work));
    TestBed.configureTestingModule({
      providers: [
        { provide: ReviewsService, useValue: service },
        { provide: ReviewWorkService, useValue: { resolve } },
        {
          provide: BooksService,
          useValue: { getById: () => of({ idExternal: bookId, title: 'Libro' }) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(edit ? { id: 'review-id' } : {}),
              queryParamMap: convertToParamMap(story ? { storyId } : { bookId }),
            },
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });
    localStorage.setItem('userId', userId);
    const form = TestBed.runInInjectionContext(() => new ReviewForm());
    form.ngOnInit();
    return { form, service, navigate, resolve, work };
  }
  afterEach(() => localStorage.clear());
  it('rejects short, whitespace-only, oversized reviews and invalid ratings', () => {
    const { form, service } = setup();
    for (const content of ['corta', '               ', 'x'.repeat(5001)]) {
      form.form.patchValue({ content });
      form.submit();
    }
    form.form.patchValue({ content: 'Una reseña válida', rating: 6 });
    form.submit();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('blocks duplicate submissions while saving', () => {
    const { form, service } = setup();
    form.form.patchValue({ content: 'Una reseña válida' });
    form.saving.set(true);
    form.submit();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('does not create without a session UUID', () => {
    const { form, service } = setup();
    localStorage.removeItem('userId');
    form.form.patchValue({ content: 'Una reseña válida' });
    form.submit();
    expect(service.create).not.toHaveBeenCalled();
    expect(form.error()).toContain('sesión');
  });
  it('prefills editing and sends only rating and content', () => {
    const { form, service } = setup(true);
    expect(form.form.controls.rating.value).toBe(3);
    form.form.patchValue({ rating: 4, content: '  Una opinión actualizada.  ' });
    form.submit();
    expect(service.update).toHaveBeenCalledWith('review-id', {
      rating: 4,
      content: 'Una opinión actualizada.',
    });
    expect(service.create).not.toHaveBeenCalled();
    expect(form.selectedWork()?.title).toBe('Libro de prueba');
    expect(form.selectedWork()?.author).toBe('Autora de prueba');
  });
  it('denies editing another reader’s review', () => {
    const { form, service } = setup(true, false);
    form.submit();
    expect(form.allowed()).toBe(false);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('preserves input and releases the saving state after a conflict', () => {
    const { form, service } = setup();
    service.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    form.form.patchValue({ content: 'Una reseña válida' });
    form.submit();
    expect(form.error()).toContain('Ya publicaste');
    expect(form.saving()).toBe(false);
    expect(form.form.controls.content.value).toBe('Una reseña válida');
  });
  it('never uses the JWT email subject as a reviewer UUID', () => {
    setup();
    localStorage.removeItem('userId');
    localStorage.setItem(
      'token',
      `header.${btoa(JSON.stringify({ sub: 'reader@example.com', roles: [] }))}.signature`,
    );
    expect(TestBed.inject(ReviewSessionService).userId()).toBeNull();
  });
  it('resolves the story title and author when creating a story review', () => {
    const { form, service, resolve } = setup(false, true, true);
    expect(resolve).toHaveBeenCalledWith({ bookId: null, storyId });
    expect(form.selectedWork()?.title).toBe('Historia de prueba');
    expect(form.selectedWork()?.author).toBe('Autora de prueba');
    form.form.patchValue({ content: 'Una reseña de la historia.' });
    form.submit();
    expect(service.create).toHaveBeenCalledWith({
      bookId: null,
      storyId,
      reviewerId: userId,
      rating: 5,
      content: 'Una reseña de la historia.',
    });
  });
  it('keeps a story association when editing and loads its metadata', () => {
    const { form, service } = setup(true, true, true);
    expect(form.selectedWork()?.kind).toBe('story');
    expect(form.selectedWork()?.title).toBe('Historia de prueba');
    form.form.patchValue({ content: 'Una reseña actualizada.' });
    form.submit();
    expect(service.update).toHaveBeenCalledWith('review-id', {
      rating: 3,
      content: 'Una reseña actualizada.',
    });
  });
  it('blocks publishing an unavailable story and allows loading it again', () => {
    const { form, service, resolve, work } = setup(false, true, true);
    resolve.mockReturnValueOnce(of({ ...work, unavailable: true }));
    form.load();
    form.form.patchValue({ content: 'Una reseña de prueba.' });
    form.submit();
    expect(form.loadError()).toContain('No se pudo cargar');
    expect(service.create).not.toHaveBeenCalled();
    form.load();
    expect(form.loadError()).toBe('');
    expect(form.selectedWork()?.unavailable).toBe(false);
  });
});
