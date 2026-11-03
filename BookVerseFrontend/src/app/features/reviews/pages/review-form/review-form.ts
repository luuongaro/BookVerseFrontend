import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewSessionService, UUID_PATTERN } from '../../services/review-session.service';
import { BooksService } from '../../../books/services/books.service';
import { Book } from '../../../books/models/book.model';
import { LibraryService, libraryError } from '../../../library/services/library.service';
import {
  LibraryBook,
  LibraryStory,
} from '../../../library/models/library-book.model';
import { ReviewWork, ReviewWorkService } from '../../services/review-work.service';
@Component({
  selector: 'app-review-form',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './review-form.html',
  styleUrl: './review-form.css',
})
export class ReviewForm implements OnInit {
  private readonly service = inject(ReviewsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(ReviewSessionService);
  private readonly booksService = inject(BooksService);
  private readonly libraryService = inject(LibraryService);
  private readonly works = inject(ReviewWorkService);
  private readonly destroyRef = inject(DestroyRef);
  id = this.route.snapshot.paramMap.get('id');
  bookId = this.route.snapshot.queryParamMap.get('bookId');
  storyId = this.route.snapshot.queryParamMap.get('storyId');
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  loadError = signal('');
  allowed = signal(true);
  selectedBook = signal<Book | null>(null);
  libraryBooks = signal<LibraryBook[]>([]);
  libraryStories = signal<LibraryStory[]>([]);
  workType = signal<'book' | 'story' | ''>('');
  selectedWork = signal<ReviewWork | null>(null);
  form = this.fb.nonNullable.group({
    bookId: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    storyId: [''],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    content: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
  });

  authorInitials(author: string): string {
    const words = author.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  ngOnInit(): void {
    this.load();
  }
  load(): void {
    this.loadError.set('');
    this.error.set('');
    if (this.id) {
      this.form.controls.bookId.clearValidators();
      this.form.controls.bookId.updateValueAndValidity();
      this.loading.set(true);
      this.service
        .getById(this.id)
        .pipe(
          switchMap((review) => this.works.resolve(review).pipe(map((work) => ({ review, work })))),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: ({ review, work }) => {
            this.allowed.set(this.session.canEdit(review));
            this.form.patchValue({ rating: review.rating, content: review.content });
            this.bookId = review.bookId;
            this.storyId = review.storyId;
            this.selectedWork.set(work);
            this.loading.set(false);
          },
          error: (error) => {
            this.loadError.set(apiError(error));
            this.loading.set(false);
          },
        });
    } else if (this.bookId && this.storyId) {
      this.allowed.set(false);
      this.loadError.set('Una reseña debe corresponder a una sola obra.');
    } else if (this.storyId) {
      if (!UUID_PATTERN.test(this.storyId)) {
        this.allowed.set(false);
        this.loadError.set('La historia seleccionada no es válida.');
        return;
      }
      this.form.controls.bookId.clearValidators();
      this.form.controls.bookId.updateValueAndValidity();
      this.loading.set(true);
      this.works
        .resolve({ bookId: null, storyId: this.storyId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (work) => {
            this.selectedWork.set(work);
            if (work.unavailable) this.loadError.set('No se pudo cargar la historia seleccionada.');
            this.loading.set(false);
          },
          error: (error) => {
            this.loadError.set(apiError(error));
            this.loading.set(false);
          },
        });
    } else if (this.bookId) {
      this.loading.set(true);
      this.booksService
        .getById(this.bookId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (book) => {
            this.selectedBook.set(book);
            this.form.controls.bookId.setValue(book.idExternal);
            this.loading.set(false);
          },
          error: (error) => {
            this.loadError.set(apiError(error));
            this.loading.set(false);
          },
        });
    } else {
      this.loadLibrary();
    }
  }

  selectWorkType(type: 'book' | 'story'): void {
    this.workType.set(type);

    const bookControl = this.form.controls.bookId;
    const storyControl = this.form.controls.storyId;

    bookControl.reset('');
    storyControl.reset('');

    this.bookId = null;
    this.storyId = null;
    this.selectedBook.set(null);
    this.selectedWork.set(null);
    this.error.set('');
    this.loadError.set('');

    if (type === 'book') {
      bookControl.setValidators([
        Validators.required,
        Validators.pattern(UUID_PATTERN),
      ]);
      storyControl.clearValidators();
    } else {
      bookControl.clearValidators();
      storyControl.setValidators([
        Validators.required,
        Validators.pattern(UUID_PATTERN),
      ]);
    }

    bookControl.updateValueAndValidity();
    storyControl.updateValueAndValidity();
  }

  loadLibrary(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.loadError.set('');

    this.libraryService
      .getMyLibrary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.libraryBooks.set(library.entries);
          this.libraryStories.set(library.stories ?? []);
          this.loading.set(false);
        },
        error: (error) => {
          this.loadError.set(libraryError(error));
          this.loading.set(false);
        },
      });
  }

  submit(): void {
    if (this.loading() || this.saving() || !this.allowed() || this.loadError()) return;
    const values = this.form.getRawValue();
    this.form.controls.content.setValue(values.content.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const reviewerId = this.session.userId();
    if (!this.id && !reviewerId) {
      this.error.set('Volvé a iniciar sesión para publicar tu reseña.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const content = { rating: Number(values.rating), content: values.content.trim() };
    const selectedStoryId = values.storyId || this.storyId;
    const selectedBookId = values.bookId || this.bookId;

    const request = this.id
      ? this.service.update(this.id, content)
      : this.service.create({
          ...content,
          reviewerId: reviewerId!,
          bookId: selectedStoryId ? null : selectedBookId,
          storyId: selectedStoryId,
        });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (review) => {
        this.saving.set(false);
        void this.router.navigate(['/reviews', review.reviewId]);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.saving.set(false);
      },
    });
  }
}
