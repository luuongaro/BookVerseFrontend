import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
  readonly statusDialog = viewChild.required<ElementRef<HTMLDialogElement>>('statusDialog');
  readonly readingStates: ReadingState[] = [
    'WANT_TO_READ',
    'IN_PROGRESS',
    'FINISHED',
    'RE_READING',
    'ABANDONED',
  ];
  editing = signal<LibraryBook | null>(null);
  draftStatus = signal<ReadingState>('WANT_TO_READ');
  saving = signal(false);
  saveError = signal('');
  confirmation = signal('');
  editStatus(entry: LibraryBook): void {
    if (this.saving()) return;
    this.editing.set(entry);
    this.draftStatus.set(entry.reading.status);
    this.saveError.set('');
    this.confirmation.set('');
    this.statusDialog().nativeElement.showModal();
  }
  chooseStatus(value: string): void {
    if (this.readingStates.includes(value as ReadingState))
      this.draftStatus.set(value as ReadingState);
  }
  closeEditor(): void {
    if (!this.saving()) this.statusDialog().nativeElement.close();
  }
  saveStatus(): void {
    const entry = this.editing();
    if (!entry || this.saving() || this.draftStatus() === entry.reading.status) return;
    this.saving.set(true);
    this.saveError.set('');
    this.service
      .updateStatus(entry.reading, this.draftStatus())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reading) => {
          this.entries.update((entries) =>
            entries.map((item) =>
              item.reading.idExternal === entry.reading.idExternal ? { ...item, reading } : item,
            ),
          );
          this.saving.set(false);
          this.confirmation.set(`${entry.book.title}: ${this.statusLabel(reading.status)}.`);
          this.statusDialog().nativeElement.close();
        },
        error: (error) => {
          this.saveError.set(
            error instanceof LibrarySessionError ? error.message : apiError(error),
          );
          this.saving.set(false);
        },
      });
  }
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
      ABANDONED: 'Abandonado',
      RE_READING: 'Releyendo',
    }[state];
  }
}
