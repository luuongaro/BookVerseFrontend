import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReviewReportsService } from '../../services/review-reports.service';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(ReviewSessionService);
  reviewId = '';
  saving = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
    details: ['', Validators.maxLength(3000)],
  });

  ngOnInit(): void {
    this.reviewId = this.route.snapshot.queryParamMap.get('reviewId') ?? '';
    if (!UUID_PATTERN.test(this.reviewId)) this.error.set('La reseña seleccionada no es válida.');
    if (!this.session.userId()) this.error.set('Iniciá sesión para reportar una reseña.');
  }

  submit(): void {
    const reporterUserId = this.session.userId();
    if (!reporterUserId || !UUID_PATTERN.test(this.reviewId) || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.service.create({
      reviewId: this.reviewId,
      reporterUserId,
      reason: this.form.controls.reason.value.trim(),
      details: this.form.controls.details.value.trim() || null,
    }).subscribe({
      next: (report) => {
        this.saving.set(false);
        void this.router.navigate(['/review-reports', report.reportId]);
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
