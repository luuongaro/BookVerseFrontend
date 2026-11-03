import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReviewReportsService } from '../../services/review-reports.service';
import { StoryReportsService } from '../../services/story-reports.service';
import { ReviewSessionService } from '../../services/review-session.service';
import { apiError } from '../../../../core/api/api.config';
import { UUID_PATTERN } from '../../services/review-session.service';

@Component({
  selector: 'app-review-report-form',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './report-form.html',
  styleUrl: './report-form.css',
})
export class ReviewReportForm implements OnInit {
  private readonly service = inject(ReviewReportsService);
  private readonly storyService = inject(StoryReportsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(ReviewSessionService);
  reviewId = '';
  storyId = '';
  isStoryReport = signal(false);
  saving = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
    details: ['', Validators.maxLength(3000)],
  });

  ngOnInit(): void {
    this.reviewId = this.route.snapshot.queryParamMap.get('reviewId') ?? '';
    this.storyId = this.route.snapshot.queryParamMap.get('storyId') ?? '';

    const hasReviewId = !!this.reviewId;
    const hasStoryId = !!this.storyId;

    if (hasReviewId === hasStoryId) {
      this.error.set('No se pudo identificar el contenido a reportar.');
    } else if (hasStoryId) {
      this.isStoryReport.set(true);
      if (!UUID_PATTERN.test(this.storyId)) {
        this.error.set('La historia seleccionada no es válida.');
      }
    } else if (!UUID_PATTERN.test(this.reviewId)) {
      this.error.set('La reseña seleccionada no es válida.');
    }

    if (!this.session.userId()) {
      this.error.set('Iniciá sesión para enviar un reporte.');
    }
  }

  submit(): void {
    const reporterUserId = this.session.userId();
    const targetId = this.isStoryReport() ? this.storyId : this.reviewId;

    if (!reporterUserId || !UUID_PATTERN.test(targetId) || this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const reason = this.form.controls.reason.value.trim();
    const details = this.form.controls.details.value.trim() || null;

    this.saving.set(true);
    this.error.set('');

    if (this.isStoryReport()) {
      this.storyService
        .create({
          storyId: this.storyId,
          reason,
          details,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            void this.router.navigate(['/stories', this.storyId]);
          },
          error: (error) => {
            this.error.set(
              error instanceof HttpErrorResponse && error.status === 409
                ? 'Ya existe un reporte pendiente sobre esta historia.'
                : apiError(error),
            );
            this.saving.set(false);
          },
        });

      return;
    }

    this.service.create({
      reviewId: this.reviewId,
      reporterUserId,
      reason,
      details,
    }).subscribe({
      next: (report) => {
        this.saving.set(false);
        void this.router.navigate(['/reports', report.reportId]);
      },
      error: (error) => {
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 409
            ? 'Ya existe un reporte pendiente de esta reseña. El equipo lo revisará pronto.'
            : apiError(error),
        );
        this.saving.set(false);
      },
    });
  }
}
