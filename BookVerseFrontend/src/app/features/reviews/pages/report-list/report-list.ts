import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReviewReportsService } from '../../services/review-reports.service';
import { storyCoverFor } from '../../services/review-work.service';
import { ReviewReport, ReviewReportStatus } from '../../models/review-report.model';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-review-report-list',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './report-list.html',
  styleUrl: './report-list.css',
})
export class ReviewReportList implements OnInit {
  private readonly service = inject(ReviewReportsService);
  private readonly formBuilder = inject(FormBuilder);
  reports = signal<ReviewReport[]>([]);
  readonly storyCoverFor = storyCoverFor;
  selectedReport = signal<ReviewReport | null>(null);
  toastMessage = signal('');
  saving = signal(false);
  actionError = signal('');

  resolutionForm = this.formBuilder.nonNullable.group({
    resolutionComment: ['', Validators.maxLength(3000)],
  });

  loading = signal(true);
  error = signal('');
  showingAll = signal(false);
  statusFilter = signal<'ALL' | ReviewReportStatus>('ALL');
  searchTerm = signal('');
  reasonFilter = signal('ALL');

  reasonOptions = computed(() =>
    [...new Set(this.reports().map((report) => report.reason))].sort(),
  );

  pendingCount = computed(
    () => this.reports().filter((report) => report.status === 'PENDING').length,
  );

  approvedCount = computed(
    () => this.reports().filter((report) => report.status === 'APPROVED').length,
  );

  rejectedCount = computed(
    () => this.reports().filter((report) => report.status === 'REJECTED').length,
  );

  currentPage = signal(1);
  readonly pageSize = 8;

  pageCount = computed(() =>
    Math.ceil(this.filteredReports().length / this.pageSize),
  );

  pageNumbers = computed(() =>
    Array.from({ length: this.pageCount() }, (_, index) => index + 1),
  );

  paginatedReports = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredReports().slice(start, start + this.pageSize);
  });

  filteredReports = computed(() => {
    const status = this.statusFilter();
    const reason = this.reasonFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase('es');

    return this.reports().filter((report) => {
      const matchesStatus = status === 'ALL' || report.status === status;
      const matchesReason = reason === 'ALL' || report.reason === reason;

      const searchableText = [
        report.reviewId,
        report.reportId,
        report.reporterUserId,
        report.reason,
        report.details ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('es');

      const matchesSearch = !search || searchableText.includes(search);

      return matchesStatus && matchesReason && matchesSearch;
    });
  });

  ngOnInit(): void {
    this.showingAll.set(true);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const request = this.showingAll() ? this.service.getAll() : this.service.getPending();
    request.subscribe({
      next: (reports) => {
        this.reports.set(reports);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  toggleScope(): void {
    this.showingAll.update((showingAll) => !showingAll);
    this.statusFilter.set('ALL');
    this.currentPage.set(1);
    this.load();
  }

  setFilter(value: string): void {
    this.statusFilter.set(value as 'ALL' | ReviewReportStatus);
    this.currentPage.set(1);
  }

  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  setReasonFilter(value: string): void {
    this.reasonFilter.set(value);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const lastPage = Math.max(1, this.pageCount());
    this.currentPage.set(Math.min(Math.max(page, 1), lastPage));
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  openReport(report: ReviewReport): void {
    this.selectedReport.set(report);
    this.actionError.set('');
    this.resolutionForm.reset({
      resolutionComment: report.resolutionComment ?? '',
    });
  }

  closeReport(): void {
    if (!this.saving()) {
      this.selectedReport.set(null);
    }
  }

  moderate(action: 'approve' | 'reject'): void {
    const report = this.selectedReport();

    if (!report || report.status !== 'PENDING' || this.saving()) {
      return;
    }

    if (this.resolutionForm.invalid) {
      this.resolutionForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    const request = {
      resolutionComment:
        this.resolutionForm.controls.resolutionComment.value.trim() || null,
    };

    const operation =
      action === 'approve'
        ? this.service.approve(report.reportId, request)
        : this.service.reject(report.reportId, request);

    operation.subscribe({
      next: (updatedReport) => {
        this.reports.update((reports) =>
          reports.map((item) =>
            item.reportId === updatedReport.reportId ? updatedReport : item,
          ),
        );
        this.selectedReport.set(null);
        this.saving.set(false);
        this.toastMessage.set(
          action === 'approve'
            ? 'Reporte aprobado. La reseña fue retirada.'
            : 'Reporte rechazado. La reseña permanece publicada.',
        );

        window.setTimeout(() => this.toastMessage.set(''), 2500);
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(
          error.status === 409
            ? 'Este reporte ya fue moderado. Actualizá la página para ver su estado.'
            : 'No se pudo guardar la decisión. Intentá nuevamente.',
        );
        this.saving.set(false);
      },
    });
  }
}
