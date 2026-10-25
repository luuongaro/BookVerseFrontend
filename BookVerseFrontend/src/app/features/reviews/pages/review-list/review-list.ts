import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { ReviewReadersService } from '../../services/review-readers.service';
import { Subscription, switchMap, map, forkJoin } from 'rxjs';
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
  imports: [RouterLink, ReactiveFormsModule, CatalogNav, DatePipe, BookCover, NgTemplateOutlet],
  templateUrl: './review-list.html',
  styleUrl: './review-list.css',
})
export class ReviewList implements OnInit {
  private readonly service = inject(ReviewsService);
  private readonly worksService = inject(ReviewWorkService);
  readonly session = inject(ReviewSessionService);
  private readonly readersService = inject(ReviewReadersService);
  readers = signal<Record<string, string>>({});
  view = signal('cards');
  readonly ratingLevels = [5, 4, 3, 2, 1];
  activeTab = computed(() => (this.mine() ? 'mine' : this.kind()));
  selectTab(tab: string): void {
    this.mine.set(tab === 'mine');
    this.kind.set(tab === 'mine' ? 'all' : tab);
  }
  stars(rating: number): string {
    return (
      '★'.repeat(Math.max(0, Math.min(5, Math.round(rating)))) +
      '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(rating))))
    );
  }
  readerName(review: Review): string {
    return this.readers()[review.reviewerId] || 'Lector de BookVerse';
  }
  initials(review: Review): string {
    return this.readerName(review)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase();
  }
  ratingPercent(rating: number): number {
    const reviews = this.visibleReviews();
    return reviews.length
      ? Math.round(
          (100 * reviews.filter((review) => review.rating === rating).length) / reviews.length,
        )
      : 0;
  }
  cards = computed(() =>
    this.groups()
      .flatMap((group) => group.reviews.map((review) => ({ review, work: group.work })))
      .sort((a, b) =>
        this.sort() === 'rating'
          ? b.review.rating - a.review.rating ||
            b.review.createdAt.localeCompare(a.review.createdAt)
          : b.review.createdAt.localeCompare(a.review.createdAt),
      ),
  );
  featured = computed(
    () =>
      [...this.cards()].sort(
        (a, b) =>
          b.review.rating - a.review.rating || b.review.createdAt.localeCompare(a.review.createdAt),
      )[0] ?? null,
  );
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
          forkJoin({
            works: this.worksService.resolveAll(reviews),
            readers: this.readersService.resolve(reviews.map((review) => review.reviewerId)),
          }).pipe(map(({ works, readers }) => ({ reviews, works, readers }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ reviews, works, readers }) => {
          this.readers.set(readers);
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
