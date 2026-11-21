import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReviewReportsService } from '../../services/review-reports.service';
import { StoryReport } from '../../models/story-report.model';
import { StoryReportsService } from '../../services/story-reports.service';
import { storyCoverFor } from '../../services/review-work.service';
import { ReviewReport, ReviewReportStatus } from '../../models/review-report.model';
import { apiError } from '../../../../core/api/api.config';
import {
  GroupCommentReport,
  GroupCommentReportsService,
} from '../../../groups/services/group-comment-reports.service';
import { ReadingGroupsService } from '../../../groups/services/reading-groups.service';
import { catchError, forkJoin, map, of } from 'rxjs';

@Component({
  selector: 'app-review-report-list',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './report-list.html',
  styleUrl: './report-list.css',
})
export class ReviewReportList implements OnInit {
  private readonly service = inject(ReviewReportsService);
  private readonly storyService = inject(StoryReportsService);
  private readonly commentService = inject(GroupCommentReportsService);
  private readonly groupsService = inject(ReadingGroupsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  reports = signal<ReviewReport[]>([]);
  storyReports = signal<StoryReport[]>([]);
  commentReports = signal<GroupCommentReport[]>([]);
  groupNames = signal<Record<string, string>>({});
  activeCategory = signal<'REVIEWS' | 'STORIES' | 'COMMENTS'>('REVIEWS');
  readonly storyCoverFor = storyCoverFor;
  selectedReport = signal<ReviewReport | null>(null);
  selectedStoryReport = signal<StoryReport | null>(null);
  selectedCommentReport = signal<GroupCommentReport | null>(null);
  toastMessage = signal('');
  saving = signal(false);
  actionError = signal('');
  confirmRestore = signal(false);

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

  storyReasonOptions = computed(() =>
    [...new Set(this.storyReports().map((report) => report.reason))].sort(),
  );

  storyPendingCount = computed(
    () => this.storyReports().filter((report) => report.status === 'PENDING').length,
  );

  storyApprovedCount = computed(
    () => this.storyReports().filter((report) => report.status === 'APPROVED').length,
  );

  storyRejectedCount = computed(
    () => this.storyReports().filter((report) => report.status === 'REJECTED').length,
  );

  commentReasonOptions = computed(() =>
    [...new Set(this.commentReports().map((report) => report.reason))].sort(),
  );

  commentPendingCount = computed(
    () => this.commentReports().filter((report) => report.status === 'PENDING').length,
  );

  commentApprovedCount = computed(
    () => this.commentReports().filter((report) => report.status === 'APPROVED').length,
  );

  commentRejectedCount = computed(
    () => this.commentReports().filter((report) => report.status === 'REJECTED').length,
  );

  activeCategoryLabel = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return 'Reportes de historias';
      case 'COMMENTS':
        return 'Reportes de comentarios';
      default:
        return 'Reportes de reseñas';
    }
  });

  activeTargetLabel = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return 'historia denunciada';
      case 'COMMENTS':
        return 'comentario denunciado';
      default:
        return 'reseña denunciada';
    }
  });

  activeTotalCount = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return this.storyReports().length;
      case 'COMMENTS':
        return this.commentReports().length;
      default:
        return this.reports().length;
    }
  });

  activePendingCount = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return this.storyPendingCount();
      case 'COMMENTS':
        return this.commentPendingCount();
      default:
        return this.pendingCount();
    }
  });

  activeApprovedCount = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return this.storyApprovedCount();
      case 'COMMENTS':
        return this.commentApprovedCount();
      default:
        return this.approvedCount();
    }
  });

  activeRejectedCount = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return this.storyRejectedCount();
      case 'COMMENTS':
        return this.commentRejectedCount();
      default:
        return this.rejectedCount();
    }
  });

  activeSearchPlaceholder = computed(() => {
    switch (this.activeCategory()) {
      case 'STORIES':
        return 'Buscar por historia o motivo…';
      case 'COMMENTS':
        return 'Buscar por comentario o motivo…';
      default:
        return 'Buscar por reseña o motivo…';
    }
  });

  currentPage = signal(1);
  readonly pageSize = 8;

  filteredStoryReports = computed(() => {
    const status = this.statusFilter();
    const reason = this.reasonFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase('es');

    return this.storyReports().filter((report) => {
      const matchesStatus = status === 'ALL' || report.status === status;
      const matchesReason = reason === 'ALL' || report.reason === reason;

      const searchableText = [
        report.reportId,
        report.storyId,
        report.storyTitle,
        report.storyAuthorUsername,
        report.reporterUserId,
        report.reporterUsername ?? '',
        report.reason,
        report.details ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('es');

      return matchesStatus && matchesReason && (!search || searchableText.includes(search));
    });
  });

  storyPageCount = computed(() =>
    Math.ceil(this.filteredStoryReports().length / this.pageSize),
  );

  storyPageNumbers = computed(() =>
    Array.from({ length: this.storyPageCount() }, (_, index) => index + 1),
  );

  paginatedStoryReports = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredStoryReports().slice(start, start + this.pageSize);
  });

  filteredCommentReports = computed(() => {
    const status = this.statusFilter();
    const reason = this.reasonFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase('es');

    return this.commentReports().filter((report) => {
      const matchesScope = this.showingAll() || report.status === 'PENDING';
      const matchesStatus = status === 'ALL' || report.status === status;
      const matchesReason = reason === 'ALL' || report.reason === reason;
      const searchableText = [
        report.reportId,
        report.commentId,
        report.groupId,
        report.commentAuthorUsername ?? '',
        report.reporterUsername ?? '',
        report.commentContent,
        report.reason,
        report.details ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('es');

      return matchesScope && matchesStatus && matchesReason && (!search || searchableText.includes(search));
    });
  });

  commentPageCount = computed(() =>
    Math.ceil(this.filteredCommentReports().length / this.pageSize),
  );

  commentPageNumbers = computed(() =>
    Array.from({ length: this.commentPageCount() }, (_, index) => index + 1),
  );

  paginatedCommentReports = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredCommentReports().slice(start, start + this.pageSize);
  });

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

  activePageCount = computed(() =>
    this.activeCategory() === 'REVIEWS'
      ? this.pageCount()
      : this.activeCategory() === 'STORIES'
        ? this.storyPageCount()
        : this.commentPageCount(),
  );

  activePageNumbers = computed(() =>
    this.activeCategory() === 'REVIEWS'
      ? this.pageNumbers()
      : this.activeCategory() === 'STORIES'
        ? this.storyPageNumbers()
        : this.commentPageNumbers(),
  );

  activeFilteredCount = computed(() =>
    this.activeCategory() === 'REVIEWS'
      ? this.filteredReports().length
      : this.activeCategory() === 'STORIES'
        ? this.filteredStoryReports().length
        : this.filteredCommentReports().length,
  );

  activePaginatedCount = computed(() =>
    this.activeCategory() === 'REVIEWS'
      ? this.paginatedReports().length
      : this.activeCategory() === 'STORIES'
        ? this.paginatedStoryReports().length
        : this.paginatedCommentReports().length,
  );

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
    const category = this.route.snapshot.queryParamMap.get('category');
    const isCommentRoute = this.route.snapshot.url.some(
      (segment) => segment.path === 'comments',
    );

    if (category === 'stories') {
      this.activeCategory.set('STORIES');
    } else if (category === 'comments' || isCommentRoute) {
      this.activeCategory.set('COMMENTS');
    }
    this.showingAll.set(true);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    if (this.activeCategory() === 'REVIEWS') {
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

      return;
    }

    if (this.activeCategory() === 'STORIES') {
      const request = this.showingAll()
        ? this.storyService.getAll()
        : this.storyService.getPending();

      request.subscribe({
        next: (reports) => {
          this.storyReports.set(reports);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });

      return;
    }

    this.commentService.getAll().subscribe({
      next: (reports) => this.loadCommentGroupNames(reports),
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }

  groupNameFor(report: GroupCommentReport): string {
    return (
      report.groupName?.trim() ||
      this.groupNames()[report.groupId] ||
      'Grupo sin nombre'
    );
  }

  private loadCommentGroupNames(reports: GroupCommentReport[]): void {
    this.commentReports.set(reports);

    const groupIds = [...new Set(reports.map((report) => report.groupId))];

    if (groupIds.length === 0) {
      this.loading.set(false);
      return;
    }

    forkJoin(
      groupIds.map((groupId) =>
        this.groupsService.getById(groupId).pipe(
          map((group) => ({ groupId, name: group.name })),
          catchError(() => of({ groupId, name: '' })),
        ),
      ),
    ).subscribe((groups) => {
      this.groupNames.update((names) => {
        const updatedNames = { ...names };

        for (const group of groups) {
          if (group.name) {
            updatedNames[group.groupId] = group.name;
          }
        }

        return updatedNames;
      });
      this.loading.set(false);
    });
  }

  selectCategory(category: 'REVIEWS' | 'STORIES' | 'COMMENTS'): void {
    this.activeCategory.set(category);
    this.statusFilter.set('ALL');
    this.reasonFilter.set('ALL');
    this.searchTerm.set('');
    this.currentPage.set(1);

    void this.router.navigate(['/reports'], {
      queryParams: {
        category: category === 'REVIEWS' ? null : category.toLowerCase(),
      },
    });

    this.load();
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
    const lastPage = Math.max(1, this.activePageCount());
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
    this.confirmRestore.set(false);
    this.resolutionForm.reset({
      resolutionComment: report.resolutionComment ?? '',
    });
  }

  openStoryReport(report: StoryReport): void {
    this.selectedStoryReport.set(report);
    this.actionError.set('');
    this.confirmRestore.set(false);

    this.storyService.getById(report.reportId).subscribe({
      next: (updatedReport) => {
        this.selectedStoryReport.set(updatedReport);
        this.storyReports.update((reports) =>
          reports.map((item) =>
            item.reportId === updatedReport.reportId ? updatedReport : item,
          ),
        );
      },
      error: () => {
        this.actionError.set(
          'No se pudo actualizar el historial del reporte.',
        );
      },
    });

    this.resolutionForm.reset({
      resolutionComment: report.resolutionComment ?? '',
    });
  }

  openCommentReport(report: GroupCommentReport): void {
    this.selectedCommentReport.set(report);
    this.actionError.set('');
    this.confirmRestore.set(false);
    this.resolutionForm.reset({
      resolutionComment: report.resolutionComment ?? '',
    });
  }

  closeReport(): void {
    if (!this.saving()) {
      this.selectedReport.set(null);
      this.selectedStoryReport.set(null);
      this.selectedCommentReport.set(null);
    }
  }

  restoreReview(): void {
    const report = this.selectedReport();
    if (!report || report.status !== 'APPROVED' || this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.service.restore(report.reportId).subscribe({
      next: () => {
        this.service.getById(report.reportId).subscribe({
          next: (updatedReport) => {
            this.selectedReport.set(updatedReport);
            this.confirmRestore.set(false);
            this.saving.set(false);
            this.load();
            this.toastMessage.set('La restauración quedó registrada.');
            window.setTimeout(() => this.toastMessage.set(''), 2500);
          },
          error: () => {
            this.saving.set(false);
            this.actionError.set(
              'El contenido fue restaurado, pero no se pudo actualizar el historial. Cerrá y volvé a abrir el reporte.',
            );
            this.load();
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.actionError.set('No se pudo restaurar la reseña. Es posible que ya esté disponible o que haya sido eliminada.');
      },
    });
  }

  restoreStory(): void {
    const report = this.selectedStoryReport();

    if (
      !report ||
      report.status !== 'APPROVED' ||
      !report.storyModerationRemoved ||
      this.saving()
    ) {
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    this.storyService.restore(report.reportId).subscribe({
      next: () => {
        this.storyService.getById(report.reportId).subscribe({
          next: (updatedReport) => {
            this.selectedStoryReport.set(updatedReport);
            this.confirmRestore.set(false);
            this.saving.set(false);
            this.load();
            this.toastMessage.set('La restauración quedó registrada.');
            window.setTimeout(() => this.toastMessage.set(''), 2500);
          },
          error: () => {
            this.saving.set(false);
            this.actionError.set(
              'El contenido fue restaurado, pero no se pudo actualizar el historial. Cerrá y volvé a abrir el reporte.',
            );
            this.load();
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.actionError.set(
          'No se pudo restaurar la historia. Actualizá el reporte e intentá nuevamente.',
        );
      },
    });
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
      next: () => {
        this.selectedReport.set(null);
        this.saving.set(false);
        this.toastMessage.set(
          action === 'approve'
            ? 'Reporte aprobado. La reseña fue retirada.'
            : 'Reporte rechazado. La reseña permanece publicada.',
        );

        this.load();
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

  moderateStory(action: 'approve' | 'reject'): void {
    const report = this.selectedStoryReport();

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
        ? this.storyService.approve(report.reportId, request)
        : this.storyService.reject(report.reportId, request);

    operation.subscribe({
      next: () => {
        this.selectedStoryReport.set(null);
        this.saving.set(false);
        this.toastMessage.set(
          action === 'approve'
            ? 'Reporte aprobado. La historia fue dada de baja.'
            : 'Reporte rechazado. La historia permanece disponible.',
        );

        this.load();
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

  moderateComment(action: 'approve' | 'reject'): void {
    const report = this.selectedCommentReport();

    if (!report || report.status !== 'PENDING' || this.saving()) {
      return;
    }

    if (this.resolutionForm.invalid) {
      this.resolutionForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    const request =
      this.resolutionForm.controls.resolutionComment.value.trim() || null;

    this.commentService
      .moderate(report.reportId, action, request)
      .subscribe({
        next: () => {
          this.selectedCommentReport.set(null);
          this.saving.set(false);
          this.toastMessage.set(
            action === 'approve'
              ? 'Reporte aprobado. El comentario fue moderado.'
              : 'Reporte rechazado. El comentario permanece disponible.',
          );
          this.load();
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

  restoreComment(): void {
    const report = this.selectedCommentReport();

    if (
      !report ||
      report.status !== 'APPROVED' ||
      report.commentStatus !== 'MODERATED' ||
      this.saving()
    ) {
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    this.commentService.restore(report.reportId).subscribe({
      next: () => {
        this.commentService.getById(report.reportId).subscribe({
          next: (updatedReport) => {
            this.selectedCommentReport.set(updatedReport);
            this.confirmRestore.set(false);
            this.saving.set(false);
            this.load();
            this.toastMessage.set('La restauración quedó registrada.');
            window.setTimeout(() => this.toastMessage.set(''), 2500);
          },
          error: () => {
            this.saving.set(false);
            this.actionError.set(
              'El contenido fue restaurado, pero no se pudo actualizar el historial. Cerrá y volvé a abrir el reporte.',
            );
            this.load();
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.actionError.set(
          'No se pudo restaurar el comentario. Actualizá el reporte e intentá nuevamente.',
        );
      },
    });
  }
}
