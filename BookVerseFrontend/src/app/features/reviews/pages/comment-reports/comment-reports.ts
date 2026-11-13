import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GroupCommentReport, GroupCommentReportsService } from '../../../groups/services/group-comment-reports.service';

@Component({
  selector: 'app-comment-reports',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './comment-reports.html',
  styleUrl: './comment-reports.css',
})
export class CommentReports {
  private readonly service = inject(GroupCommentReportsService);
  readonly reports = signal<GroupCommentReport[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly selected = signal<GroupCommentReport | null>(null);
  readonly filter = signal<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  readonly filteredReports = computed(() => this.reports().filter(report => this.filter() === 'ALL' || report.status === this.filter()));
  resolution = '';

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.service.getAll().subscribe({
      next: reports => { this.reports.set(reports); this.loading.set(false); },
      error: () => { this.error.set('No pudimos cargar los reportes.'); this.loading.set(false); },
    });
  }
  open(report: GroupCommentReport): void { this.selected.set(report); this.resolution = ''; this.error.set(''); }
  close(): void { if (!this.busy()) { this.selected.set(null); this.error.set(''); } }
  moderate(action: 'approve' | 'reject'): void {
    const report = this.selected();
    if (!report || report.status !== 'PENDING' || this.busy() || this.resolution.length > 3000) return;
    this.busy.set(true); this.error.set('');
    this.service.moderate(report.reportId, action, this.resolution.trim() || null).subscribe({
      next: () => { this.busy.set(false); this.selected.set(null); this.load(); },
      error: (error: HttpErrorResponse) => { this.busy.set(false); this.error.set(error.status === 409 ? 'Este reporte ya fue moderado. Actualizá la lista.' : 'No pudimos guardar la decisión. Intentá nuevamente.'); },
    });
  }
}
