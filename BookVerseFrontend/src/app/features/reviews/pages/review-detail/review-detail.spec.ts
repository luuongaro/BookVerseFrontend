import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { ReviewDetail } from './review-detail';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewWorkService } from '../../services/review-work.service';
import { Review } from '../../models/review.model';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const review: Review = {
  reviewId: 'review-id',
  reviewerId: owner,
  reviewerName: 'Marina',
  bookId: 'book-id',
  storyId: null,
  rating: 4,
  content: 'Una reseña de prueba.',
  deleted: false,
  takedownStatus: 'ACTIVE',
  takedownAt: null,
  takedownReason: null,
  createdAt: '2026-10-01T12:00:00',
  updatedAt: '2026-10-01T12:00:00',
};

describe('Review detail and deletion', () => {
  async function setup(userId = owner, role?: string) {
    localStorage.setItem('userId', userId);
    if (role)
      localStorage.setItem('token', `header.${btoa(JSON.stringify({ roles: [role] }))}.signature`);
    const remove = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'reviews/:id', component: ReviewDetail }]),
        { provide: ReviewsService, useValue: { getById: () => of(review), delete: remove } },
        {
          provide: ReviewWorkService,
          useValue: {
            resolve: () => of({ title: 'Libro de prueba', author: 'Autora', kind: 'book' }),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/reviews/review-id', ReviewDetail);
    const dialog = harness.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { component, remove, navigate, dialog, harness };
  }

  afterEach(() => localStorage.clear());

  it('shows the reviewer name and cancels deletion without sending a request', async () => {
    const { component, remove, dialog, harness } = await setup();
    expect(harness.routeNativeElement!.textContent).toContain('Por Marina');
    component.confirmDelete();
    expect(dialog.hasAttribute('open')).toBe(true);
    component.cancelDelete();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes only once, keeps the dialog while saving and returns to reviews of the same work', async () => {
    const { component, remove, navigate, dialog, harness } = await setup();
    const pending = new Subject<void>();
    remove.mockReturnValue(pending);
    component.confirmDelete();
    component.deleteReview();
    component.deleteReview();
    component.cancelDelete();
    harness.detectChanges();
    expect(remove).toHaveBeenCalledExactlyOnceWith('review-id');
    expect(component.deleting()).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    pending.next();
    pending.complete();
    expect(component.deleted()).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/reviews'], {
      queryParams: { bookId: 'book-id', storyId: null },
    });
  });

  it('keeps the review on a permission error and allows retrying', async () => {
    const { component, remove, navigate, dialog } = await setup();
    remove.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    component.confirmDelete();
    component.deleteReview();
    expect(component.deleteError()).toContain('No tenés permiso');
    expect(component.deleting()).toBe(false);
    expect(component.deleted()).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    remove.mockReturnValueOnce(of(undefined));
    component.deleteReview();
    expect(component.deleted()).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('hides edit and delete controls and blocks deletion for another reader', async () => {
    const { component, remove, dialog, harness } = await setup(other);
    expect(harness.routeNativeElement!.querySelector('.panel button.danger')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href$="/edit"]')).toBeNull();
    component.confirmDelete();
    component.deleteReview();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['ROLE_ADMIN', 'ROLE_MODERATOR'])(
    'allows %s to manage a review from another reader',
    async (role) => {
      const { component, dialog, harness } = await setup(other, role);
      expect(harness.routeNativeElement!.querySelector('.panel button.danger')).not.toBeNull();
      component.confirmDelete();
      expect(dialog.hasAttribute('open')).toBe(true);
    },
  );
});
