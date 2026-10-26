import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { apiError } from '../../../../core/api/api.config';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewSessionService, UUID_PATTERN } from '../../services/review-session.service';
import { BooksService } from '../../../books/services/books.service';
import { Book } from '../../../books/models/book.model';
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
  id = this.route.snapshot.paramMap.get('id');
  bookId = this.route.snapshot.queryParamMap.get('bookId');
  storyId = this.route.snapshot.queryParamMap.get('storyId');
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  loadError = signal('');
  allowed = signal(true);
  books = signal<Book[]>([]);
  selectedBook = signal<Book | null>(null);
  booksPage = signal(0);
  moreBooks = signal(false);
  form = this.fb.nonNullable.group({
    bookId: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    content: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
  });
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
      this.service.getById(this.id).subscribe({
        next: (review) => {
          this.allowed.set(this.session.canEdit(review));
          this.form.patchValue({ rating: review.rating, content: review.content });
          this.bookId = review.bookId;
          this.storyId = review.storyId;
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
      }
      this.form.controls.bookId.clearValidators();
      this.form.controls.bookId.updateValueAndValidity();
    } else if (this.bookId) {
      this.loading.set(true);
      this.booksService.getById(this.bookId).subscribe({
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
      this.loadBooks();
    }
  }
  loadBooks(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.booksService.getAll(this.booksPage()).subscribe({
      next: (page) => {
        this.books.update((books) => [...books, ...page.content]);
        this.moreBooks.set(!page.last);
        this.booksPage.set(page.number + 1);
        this.loading.set(false);
      },
      error: (error) => {
        this.loadError.set(apiError(error));
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
    const request = this.id
      ? this.service.update(this.id, content)
      : this.service.create({
          ...content,
          reviewerId: reviewerId!,
          bookId: this.storyId ? null : values.bookId,
          storyId: this.storyId,
        });
    request.subscribe({
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
