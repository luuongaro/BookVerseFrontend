import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReviewReportsService } from '../../services/review-reports.service';
import { ReviewReport } from '../../models/review-report.model';
import { apiError } from '../../../../core/api/api.config';
import { CatalogNav } from '../../../../shared/components/catalog-nav/catalog-nav';

@Component({
  selector: 'app-review-report-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, CatalogNav],
  templateUrl: './report-detail.html',
  styleUrl: './report-detail.css',
})
export class ReviewReportDetail implements OnInit {
  private readonly service = inject(ReviewReportsService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  report = signal<ReviewReport | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  actionError = signal('');
  form = this.fb.nonNullable.group({ resolutionComment: ['', Validators.maxLength(3000)] });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No se encontró el identificador del reporte.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.service.getById(id).subscribe({
      next: (report) => {
        this.report.set(report);
        this.form.patchValue({ resolutionComment: report.resolutionComment ?? '' });
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  moderate(action: 'approve' | 'reject'): void {
    const report = this.report();
    if (!report || report.status !== 'PENDING' || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.actionError.set('');
    const request = { resolutionComment: this.form.controls.resolutionComment.value.trim() || null };
    const operation = action === 'approve'
      ? this.service.approve(report.reportId, request)
      : this.service.reject(report.reportId, request);
    operation.subscribe({
      next: (updated) => {
        this.report.set(updated);
        this.saving.set(false);
      },
      error: (error) => {
        this.actionError.set(
          error instanceof HttpErrorResponse && error.status === 409
            ? 'Este reporte ya fue moderado. Actualizá la página para ver su estado.'
            : apiError(error),
        );
        this.saving.set(false);
      },
    });
  }
}
