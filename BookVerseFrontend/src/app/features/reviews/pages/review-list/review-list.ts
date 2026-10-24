import { Subscription, switchMap, map } from 'rxjs';
import { ReviewWork, ReviewWorkService } from '../../services/review-work.service';
import { ReviewSessionService } from '../../services/review-session.service';
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
  private readonly worksService = inject(ReviewWorkService);
  readonly session = inject(ReviewSessionService);
  works = signal<ReviewWork[]>([]);
  mine = signal(false);
  kind = signal('all');
  genre = signal('');
  search = signal('');
  sort = signal('newest');
  genres = computed(() =>
    [...new Set(this.works().flatMap((work) => work.genres))].sort((a, b) => a.localeCompare(b)),
  );
  groups = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.works()
      .filter(
        (work) =>
          (this.kind() === 'all' || work.kind === this.kind()) &&
          (!this.genre() || work.genres.includes(this.genre())) &&
          (!query || `${work.title} ${work.author}`.toLocaleLowerCase().includes(query)),
      )
      .map((work) => ({
        work,
        reviews: this.reviews()
          .filter(
            (review) =>
              (work.kind === 'book' ? review.bookId === work.id : review.storyId === work.id) &&
              (!this.mine() ||
                (!!this.session.userId() && review.reviewerId === this.session.userId())),
          )
          .sort((a, b) =>
            this.sort() === 'rating'
              ? b.rating - a.rating || b.createdAt.localeCompare(a.createdAt)
              : b.createdAt.localeCompare(a.createdAt),
          ),
      }))
      .filter((group) => group.reviews.length)
      .sort((a, b) =>
        this.sort() === 'rating'
          ? b.reviews[0].rating - a.reviews[0].rating
          : b.reviews[0].createdAt.localeCompare(a.reviews[0].createdAt),
      );
  });
  visibleReviews = computed(() => this.groups().flatMap((group) => group.reviews));
  resetFilters(): void {
    this.mine.set(false);
    this.kind.set('all');
    this.genre.set('');
    this.search.set('');
    this.sort.set('newest');
  }
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  reviews = signal<Review[]>([]);
  loading = signal(true);
  error = signal('');
  bookId = this.route.snapshot.queryParamMap.get('bookId');
  storyId = this.route.snapshot.queryParamMap.get('storyId');
  average = computed(() =>
    this.visibleReviews().length
      ? (
          this.visibleReviews().reduce((sum, review) => sum + review.rating, 0) /
          this.visibleReviews().length
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
    this.request = request
      .pipe(
        switchMap((reviews) =>
          this.worksService.resolveAll(reviews).pipe(map((works) => ({ reviews, works }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ reviews, works }) => {
          this.reviews.set(reviews);
          this.works.set(works);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
}
