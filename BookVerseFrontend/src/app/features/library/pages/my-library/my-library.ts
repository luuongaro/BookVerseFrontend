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
import { LibraryBook, ReadingState, ReadingStatus } from '../../models/library-book.model';
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
  draftPercentage = signal('');
  progressTouched = signal(false);
  progressInputValid = signal(true);
  readonly canEditPercentage = computed(() => this.allowsPercentage(this.draftStatus()));
  readonly progressError = computed(() => {
    if (!this.canEditPercentage()) return '';
    const value = this.draftPercentage().trim();
    const percentage = Number(value);
    return !this.progressInputValid() ||
      (value !== '' && (!Number.isInteger(percentage) || percentage < 0 || percentage > 100))
      ? 'Ingresá un porcentaje entero entre 0 y 100.'
      : '';
  });
  readonly percentage = computed(() => {
    const value = this.draftPercentage().trim();
    return value === '' || Number(value) === 0 ? null : Number(value);
  });
  readonly progressChanged = computed(() => {
    const reading = this.editing()?.reading;
    if (!reading || !this.canEditPercentage() || !this.progressTouched()) return false;
    const value = this.percentage();
    return value === null
      ? reading.progressType != null || reading.progressValue != null
      : reading.progressType !== 'PERCENTAGE' || reading.progressValue !== value;
  });
  readonly hasChanges = computed(
    () => this.draftStatus() !== this.editing()?.reading.status || this.progressChanged(),
  );
  saving = signal(false);
  saveError = signal('');
  confirmation = signal('');
  editStatus(entry: LibraryBook): void {
    if (this.saving()) return;
    this.editing.set(entry);
    this.draftStatus.set(entry.reading.status);
    this.draftPercentage.set(
      entry.reading.progressType === 'PERCENTAGE'
        ? (entry.reading.progressValue?.toString() ?? '')
        : '',
    );
    this.progressTouched.set(false);
    this.progressInputValid.set(true);
    this.saveError.set('');
    this.confirmation.set('');
    this.statusDialog().nativeElement.showModal();
  }
  chooseStatus(value: string): void {
    if (this.readingStates.includes(value as ReadingState))
      this.draftStatus.set(value as ReadingState);
  }
  choosePercentage(value: string, valid = true): void {
    this.draftPercentage.set(value);
    this.progressTouched.set(true);
    this.progressInputValid.set(valid);
  }
  readingPercentage(reading: ReadingStatus): number | null {
    return this.allowsPercentage(reading.status) &&
      reading.progressType === 'PERCENTAGE' &&
      reading.progressValue != null
      ? reading.progressValue
      : null;
  }
  allowsPercentage(status: ReadingState): boolean {
    return status === 'IN_PROGRESS' || status === 'RE_READING';
  }
  closeEditor(): void {
    if (!this.saving()) this.statusDialog().nativeElement.close();
  }
  saveStatus(): void {
    const entry = this.editing();
    if (!entry || this.saving() || this.progressError() || !this.hasChanges()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.service
      .updateStatus(
        entry.reading,
        this.draftStatus(),
        this.progressChanged() ? this.percentage() : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reading) => {
          this.entries.update((entries) =>
            entries.map((item) =>
              item.reading.idExternal === entry.reading.idExternal ? { ...item, reading } : item,
            ),
          );
          this.saving.set(false);
          const percentage = this.readingPercentage(reading);
          this.confirmation.set(
            `${entry.book.title}: ${this.statusLabel(reading.status)}${percentage === null ? '' : ` · ${percentage}%`}.`,
          );
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
