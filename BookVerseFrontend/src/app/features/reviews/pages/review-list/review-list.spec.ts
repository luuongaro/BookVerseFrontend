import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReviewList } from './review-list';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewWorkService } from '../../services/review-work.service';
import { Review } from '../../models/review.model';
const user = '11111111-1111-4111-8111-111111111111';
const reviews = [
  {
    reviewId: '1',
    bookId: 'book',
    storyId: null,
    reviewerId: user,
    reviewerName: 'Alex Lane',
    rating: 3,
    content: 'Una lectura',
    createdAt: '2026-01-01',
  },
  {
    reviewId: '2',
    bookId: 'book',
    storyId: null,
    reviewerId: 'other',
    reviewerName: 'Marina',
    rating: 5,
    content: 'Otra mirada',
    createdAt: '2026-02-01',
  },
  {
    reviewId: '3',
    bookId: null,
    storyId: 'story',
    reviewerId: 'other',
    reviewerName: 'Marina',
    rating: 4,
    content: 'Una historia',
    createdAt: '2026-03-01',
  },
] as Review[];
describe('Review discovery', () => {
  beforeEach(() => {
    localStorage.setItem('userId', user);
    TestBed.configureTestingModule({
      imports: [ReviewList],
      providers: [
        provideRouter([]),

        { provide: ReviewsService, useValue: { getAll: () => of(reviews) } },
        {
          provide: ReviewWorkService,
          useValue: {
            resolveAll: () =>
              of([
                {
                  key: 'book:book',
                  id: 'book',
                  kind: 'book',
                  title: 'El libro',
                  author: 'Autora',
                  genres: ['Fantasía'],
                  unavailable: false,
                },
                {
                  key: 'story:story',
                  id: 'story',
                  kind: 'story',
                  title: 'La historia',
                  author: 'Escritor',
                  genres: [],
                  unavailable: false,
                },
              ]),
          },
        },
      ],
    });
  });
  afterEach(() => localStorage.clear());
  it('groups reviews by work and shows its title and author', () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    expect(fixture.componentInstance.groups().map((group) => group.reviews.length)).toEqual([1, 2]);
    expect(fixture.nativeElement.textContent).toContain('El libro');
    expect(fixture.nativeElement.textContent).toContain('Autora');
    fixture.componentInstance.view.set('groups');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.work-group')).toHaveLength(2);
  });
  it('uses real ratings and readers in the mockup cards', () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.ratingPercent(5)).toBe(33);
    expect(component.featured()?.review.reviewId).toBe('2');
    expect(component.cards().map((entry) => entry.review.reviewId)).toEqual(['3', '2', '1']);
    expect(fixture.nativeElement.querySelectorAll('.review-card')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Alex Lane');
    component.selectTab('mine');
    fixture.detectChanges();
    expect(component.visibleReviews().map((review) => review.reviewId)).toEqual(['1']);
    expect(component.ratingPercent(3)).toBe(100);
    component.genre.set('Unknown');
    fixture.detectChanges();
    expect(component.featured()).toBeNull();
    expect(component.average()).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.review-card')).toHaveLength(0);
  });
  it('combines ownership, genre, type and author search and clears filters', () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.mine.set(true);
    component.genre.set('Fantasía');
    component.kind.set('book');
    component.search.set('AUTORA');
    expect(component.visibleReviews().map((review) => review.reviewId)).toEqual(['1']);
    expect(component.average()).toBe('3.0');
    component.kind.set('story');
    expect(component.groups()).toEqual([]);
    component.resetFilters();
    expect(component.visibleReviews()).toHaveLength(3);
  });
  it('never treats another user’s reviews as mine and sorts by rating', () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    localStorage.removeItem('userId');
    component.mine.set(true);
    expect(component.visibleReviews()).toEqual([]);
    component.mine.set(false);
    component.sort.set('rating');
    expect(component.groups()[0].reviews.map((review) => review.rating)).toEqual([5, 3]);
  });
});
