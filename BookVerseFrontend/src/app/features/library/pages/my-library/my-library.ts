import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../../core/api/api.config';
import { LibraryService, LibrarySessionError } from '../../services/library.service';
import { LibraryBook, ReadingState } from '../../models/library-book.model';
@Component({
  selector: 'app-my-library',
  imports: [RouterLink],
  templateUrl: './my-library.html',
  styleUrl: './my-library.css',
})
export class MyLibrary implements OnInit {
  private readonly service = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  entries = signal<LibraryBook[]>([]);
  loading = signal(false);
  error = signal('');
  unavailableCount = signal(0);
  filter = signal('all');
  readonly colors = ['#42445e', '#93a897', '#766081', '#caa6b4', '#8c9bb9', '#d2ad93'];
  readonly inkColors = ['#e7dab6', '#263c32', '#fff0db', '#4d2b45', '#24324b', '#49352d'];
  readonly shelves = computed(() => {
    const entries = this.entries().filter(
      (entry) => this.filter() === 'all' || entry.reading.status === this.filter(),
    );
    const rows: LibraryBook[][] = [];
    for (let i = 0; i < entries.length; i += 9) rows.push(entries.slice(i, i + 9));
    return rows;
  });
  ngOnInit(): void {
    this.load();
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.service
      .getMyBooks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.entries.set(result.entries);
          this.unavailableCount.set(result.unavailableCount);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(error instanceof LibrarySessionError ? error.message : apiError(error));
          this.loading.set(false);
        },
      });
  }
  statusLabel(state: ReadingState): string {
    return {
      WANT_TO_READ: 'Quiero leer',
      IN_PROGRESS: 'Leyendo',
      FINISHED: 'Leído',
      ABANDONED: 'Abandonados',
      RE_READING: 'Releyendo',
    }[state];
  }
}
