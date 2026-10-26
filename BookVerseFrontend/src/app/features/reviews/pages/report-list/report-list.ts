import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewReportsService } from '../../services/review-reports.service';
import { ReviewReport, ReviewReportStatus } from '../../models/review-report.model';
import { apiError } from '../../../../core/api/api.config';

@Component({
  selector: 'app-review-report-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './report-list.html',
  styleUrl: './report-list.css',
})
export class ReviewReportList implements OnInit {
  private readonly service = inject(ReviewReportsService);
  reports = signal<ReviewReport[]>([]);
  loading = signal(true);
  error = signal('');
  showingAll = signal(false);
  statusFilter = signal<'ALL' | ReviewReportStatus>('ALL');
  filteredReports = computed(() =>
    this.statusFilter() === 'ALL'
      ? this.reports()
      : this.reports().filter((report) => report.status === this.statusFilter()),
  );

  ngOnInit(): void {
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
    this.load();
  }

  setFilter(value: string): void {
    this.statusFilter.set(value as 'ALL' | ReviewReportStatus);
  }
}
