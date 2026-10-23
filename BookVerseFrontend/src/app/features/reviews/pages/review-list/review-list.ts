import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CatalogNav } from '../../../../shared/components/catalog-nav/catalog-nav';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { ReviewsService } from '../../services/reviews.service';
import { Review } from '../../models/review.model';
@Component({
  selector: 'app-review-list',
  imports: [RouterLink, ReactiveFormsModule, CatalogNav],
  templateUrl: './review-list.html',
  styleUrl: './review-list.css',
})
export class ReviewList implements OnInit {
  private readonly service = inject(ReviewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  reviews = signal<Review[]>([]);
  loading = signal(true);
  error = signal('');
  bookId = this.route.snapshot.queryParamMap.get('bookId');
  storyId = this.route.snapshot.queryParamMap.get('storyId');
  average = computed(() =>
    this.reviews().length
      ? (
          this.reviews().reduce((sum, review) => sum + review.rating, 0) / this.reviews().length
        ).toFixed(1)
      : null,
  );
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.bookId = params.get('bookId');
      this.storyId = params.get('storyId');
      this.load();
    });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    if (this.bookId && this.storyId) {
      this.error.set('Elegí un libro o una historia, no ambos.');
      this.loading.set(false);
      return;
    }
    const request = this.bookId
      ? this.service.getByBook(this.bookId)
      : this.storyId
        ? this.service.getByStory(this.storyId)
        : this.service.getAll();
    this.request = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reviews) => {
        this.reviews.set(reviews);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }
}
