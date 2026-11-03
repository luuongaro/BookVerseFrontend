import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { BookCover } from '../../../../shared/components/book-cover/book-cover';
import { Observable, Subscription, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ReviewWork, ReviewWorkService } from '../../services/review-work.service';
import { ReviewSessionService } from '../../services/review-session.service';
import { UserService } from '../../../profile/services/user.service';
import { PROFILE_AVATARS } from '../../../profile/models/profile-avatars';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Component, inject, signal, computed, linkedSignal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { ReviewsService } from '../../services/reviews.service';
import { Review } from '../../models/review.model';
@Component({
  selector: 'app-review-list',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, BookCover, NgTemplateOutlet],
  templateUrl: './review-list.html',
  styleUrl: './review-list.css',
})
export class ReviewList implements OnInit {
  private readonly service = inject(ReviewsService);
  private readonly worksService = inject(ReviewWorkService);
  private readonly users = inject(UserService);
  readonly session = inject(ReviewSessionService);
  view = signal('cards');
  readonly pageSize = 8;
  page = linkedSignal({
    source: () => ({
      mine: this.mine(),
      kind: this.kind(),
      genre: this.genre(),
      search: this.search(),
      sort: this.sort(),
      reviews: this.reviews(),
      view: this.view(),
    }),
    computation: () => 1,
  });
  pageCount = computed(() => Math.ceil(this.cards().length / this.pageSize));
  pageStart = computed(() => (this.cards().length ? (this.page() - 1) * this.pageSize + 1 : 0));
  pageEnd = computed(() => Math.min(this.page() * this.pageSize, this.cards().length));
  paginatedCards = computed(() =>
    this.cards().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize),
  );
  paginatedGroups = computed(() =>
    this.groups()
      .map((group) => ({
        ...group,
        reviews: this.paginatedCards()
          .filter((entry) => entry.work.key === group.work.key)
          .map((entry) => entry.review),
      }))
      .filter((group) => group.reviews.length),
  );
  goToPage(page: number): void {
    if (page >= 1 && page <= this.pageCount()) this.page.set(page);
  }
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
    return review.reviewerName?.trim() || 'Usuario';
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
    const reviews = this.featuredReviews();
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
  featuredEntries = computed(() => {
    const latestFirst = [...this.cards()].sort((a, b) =>
      b.review.createdAt.localeCompare(a.review.createdAt),
    );
    const byWork = new Map<string, (typeof latestFirst)[number]>();

    for (const entry of latestFirst) {
      if (!byWork.has(entry.work.key)) {
        byWork.set(entry.work.key, entry);
      }
    }

    return [...byWork.values()];
  });

  featuredIndex = linkedSignal({
    source: () => this.featuredEntries(),
    computation: () => 0,
  });

  featured = computed(
    () => this.featuredEntries()[this.featuredIndex()] ?? null,
  );

  moveFeatured(direction: number): void {
    const total = this.featuredEntries().length;
    if (total < 2) return;

    this.featuredIndex.update((index) => (index + direction + total) % total);
  }
  featuredReviews = computed(() => {
    const featured = this.featured();
    if (!featured) return [];

    return this.reviews().filter((review) =>
      featured.work.kind === 'book'
        ? review.bookId === featured.work.id
        : review.storyId === featured.work.id,
    );
  });
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
  reviewerAvatars = signal<Record<string, string>>({});
  loading = signal(true);
  error = signal('');
  bookId = this.route.snapshot.queryParamMap.get('bookId');
  storyId = this.route.snapshot.queryParamMap.get('storyId');
  average = computed(() =>
    this.featuredReviews().length
      ? (
          this.featuredReviews().reduce((sum, review) => sum + review.rating, 0) /
          this.featuredReviews().length
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

  private loadReviewerAvatars(
    reviews: Review[],
  ): Observable<Record<string, string>> {
    const reviewerIds = [
      ...new Set(reviews.map((review) => review.reviewerId).filter(Boolean)),
    ];

    if (!reviewerIds.length) return of({});

    return forkJoin(
      reviewerIds.map((reviewerId) =>
        this.users.getProfileAppearance(reviewerId).pipe(
          map((appearance) => ({
            reviewerId,
            src: PROFILE_AVATARS[appearance.avatarIndex]?.src ?? null,
          })),
          catchError(() => of({ reviewerId, src: null })),
        ),
      ),
    ).pipe(
      map((avatars) =>
        avatars.reduce<Record<string, string>>((result, avatar) => {
          if (avatar.src) result[avatar.reviewerId] = avatar.src;
          return result;
        }, {}),
      ),
    );
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
            avatars: this.loadReviewerAvatars(reviews),
          }).pipe(map(({ works, avatars }) => ({ reviews, works, avatars }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ reviews, works, avatars }) => {
          this.reviews.set(reviews);
          this.works.set(works);
          this.reviewerAvatars.set(avatars);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
}
