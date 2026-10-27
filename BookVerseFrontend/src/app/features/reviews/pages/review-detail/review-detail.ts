import { Subscription, switchMap, map } from 'rxjs';
import { ReviewWork, ReviewWorkService } from '../../services/review-work.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, ElementRef, viewChild } from '@angular/core';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { ReviewsService } from '../../services/reviews.service';
import { Review } from '../../models/review.model';
import { ReviewSessionService } from '../../services/review-session.service';
@Component({
  selector: 'app-review-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './review-detail.html',
  styleUrl: './review-detail.css',
})
export class ReviewDetail implements OnInit {
  private readonly service = inject(ReviewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  deleting = signal(false);
  deleteError = signal('');
  deleted = signal(false);
  readonly session = inject(ReviewSessionService);
  private readonly works = inject(ReviewWorkService);
  work = signal<ReviewWork | null>(null);
  review = signal<Review | null>(null);
  loading = signal(true);
  error = signal('');
  private request?: Subscription;
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.service
      .getById(this.route.snapshot.paramMap.get('id')!)
      .pipe(
        switchMap((review) => this.works.resolve(review).pipe(map((work) => ({ review, work })))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ review, work }) => {
          this.work.set(work);
          this.review.set(review);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
  confirmDelete(): void {
    const review = this.review();
    if (!review || !this.session.canEdit(review) || this.deleting() || this.deleted()) return;
    this.deleteError.set('');
    this.deleteDialog().nativeElement.showModal();
  }
  cancelDelete(): void {
    if (!this.deleting()) this.deleteDialog().nativeElement.close();
  }
  deleteReview(): void {
    const review = this.review();
    if (!review || !this.session.canEdit(review) || this.deleting() || this.deleted()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.service
      .delete(review.reviewId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleted.set(true);
          this.deleteDialog().nativeElement.close();
          void this.router.navigate(['/reviews'], {
            queryParams: { bookId: review.bookId, storyId: review.storyId },
          });
        },
        error: (error) => {
          this.deleting.set(false);
          this.deleteError.set(apiError(error));
        },
      });
  }
}
