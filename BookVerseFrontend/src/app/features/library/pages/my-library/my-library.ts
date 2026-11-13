import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { READING_STATES, readingStateLabel } from '../../models/reading-state';
import { ReadingStateBadge } from '../../components/reading-state-badge/reading-state-badge';
import { ReadingStateSelect } from '../../components/reading-state-select/reading-state-select';
import { LibraryService, libraryError } from '../../services/library.service';
import {
  LibraryBook,
  LibraryStory,
  ReadingState,
  ReadingStatus,
} from '../../models/library-book.model';
type ShelfOrder = 'original' | 'title' | 'progress' | 'custom';
type LibraryProgressMode = 'PERCENTAGE' | 'CHAPTER';
@Component({
  selector: 'app-my-library',
  imports: [RouterLink, ReadingStateBadge, ReadingStateSelect],
  templateUrl: './my-library.html',
  styleUrl: './my-library.css',
})
export class MyLibrary implements OnInit {
  private readonly service = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  entries = signal<LibraryBook[]>([]);
  stories = signal<LibraryStory[]>([]);
  restrictedCount = signal(0);
  loading = signal(false);
  error = signal('');
  unavailableCount = signal(0);
  filter = signal('all');
  shelfOrder = signal<ShelfOrder>(this.readShelfOrder());
  private readonly customOrders = signal<Record<string, string[]>>(this.readCustomOrders());
  private dragged: { shelf: string; id: string } | null = null;
  readonly statusDialog = viewChild.required<ElementRef<HTMLDialogElement>>('statusDialog');
  private readonly shelves = viewChildren<ElementRef<HTMLDivElement>>('readingShelf');
  readonly shelfStates = READING_STATES.filter((state) => state !== 'ABANDONED');
  readonly readingStates = READING_STATES;
  private readonly addedId = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('saved'))),
    { initialValue: null },
  );
  readonly addedReading = computed(
    () =>
      [...this.entries(), ...this.stories()].find(
        (entry) => entry.reading.idExternal === this.addedId(),
      ) ?? null,
  );
  editing = signal<LibraryBook | LibraryStory | null>(null);
  draftStatus = signal<ReadingState>('WANT_TO_READ');
  draftPercentage = signal('');
  progressMode = signal<LibraryProgressMode>('PERCENTAGE');
  draftChapter = signal('');
  draftTotalChapters = signal('');
  progressModeTouched = signal(false);
  chapterProgressTouched = signal(false);
  progressTouched = signal(false);
  progressInputValid = signal(true);
  readonly canEditPercentage = computed(() => {
    const entry = this.editing();
    return !!entry && 'book' in entry && this.allowsPercentage(this.draftStatus());
  });
  readonly progressError = computed(() => {
    if (!this.canEditPercentage()) {
      return '';
    }

    if (this.progressMode() === 'CHAPTER') {
      const chapterText = this.draftChapter().trim();
      const totalText = this.draftTotalChapters().trim();

      if (!chapterText || !totalText) {
        return 'Ingresá el capítulo actual y el total de capítulos.';
      }

      const chapter = Number(chapterText);
      const total = Number(totalText);

      if (!Number.isInteger(total) || total < 1) {
        return 'El total de capítulos debe ser un número entero mayor que 0.';
      }

      if (!Number.isInteger(chapter) || chapter < 1) {
        return 'El capítulo actual debe ser un número entero mayor que 0.';
      }

      if (chapter > total) {
        return `El capítulo actual no puede superar el total de ${total} capítulos.`;
      }

      return '';
    }

    const value = this.draftPercentage().trim();
    const percentage = Number(value);

    return (
      !this.progressInputValid() ||
      (value !== '' &&
        (!Number.isInteger(percentage) || percentage < 0 || percentage > 100))
    )
      ? 'Ingresá un porcentaje entero entre 0 y 100.'
      : '';
  });
  readonly percentage = computed(() => {
    const value = this.draftPercentage().trim();
    return value === '' || Number(value) === 0 ? null : Number(value);
  });
  readonly progressChanged = computed(() => {
    const reading = this.editing()?.reading;

    if (!reading || !this.canEditPercentage()) {
      return false;
    }

    const inputWasTouched =
      this.progressTouched() ||
      this.chapterProgressTouched() ||
      this.progressModeTouched();

    if (!inputWasTouched) {
      return false;
    }

    if (this.progressMode() === 'CHAPTER') {
      return (
        reading.progressType !== 'CHAPTER' ||
        reading.progressValue !== Number(this.draftChapter()) ||
        reading.progressTotal !== Number(this.draftTotalChapters())
      );
    }

    const percentage = this.percentage();

    if (percentage === null) {
      return (
        reading.progressType !== null ||
        reading.progressValue !== null ||
        reading.progressTotal != null
      );
    }

    return (
      reading.progressType !== 'PERCENTAGE' ||
      reading.progressValue !== percentage ||
      reading.progressTotal != null
    );
  });
  readonly hasChanges = computed(
    () => this.draftStatus() !== this.editing()?.reading.status || this.progressChanged(),
  );
  saving = signal(false);
  saveError = signal('');
  confirmation = signal('');
  confirmingDelete = signal(false);
  titleOf(entry: LibraryBook | LibraryStory): string {
    return 'book' in entry ? entry.book.title : entry.story.title;
  }
  storyChapterProgress(entry: LibraryStory): number | null {
    const reading = entry.reading;

    if (
      reading.progressType === 'CHAPTER' &&
      reading.progressValue !== null
    ) {
      return reading.progressValue;
    }

    return null;
  }

  storyHasProgress(entry: LibraryStory): boolean {
    return (
      entry.reading.status === 'FINISHED' ||
      this.storyChapterProgress(entry) !== null
    );
  }

  storyProgressPercent(entry: LibraryStory): number {
    if (entry.reading.status === 'FINISHED') {
      return 100;
    }

    const currentChapter = this.storyChapterProgress(entry);
    const totalChapters = entry.story.publishedChaptersCount;

    if (currentChapter === null || totalChapters <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((currentChapter / totalChapters) * 100),
    );
  }

  storyProgressText(entry: LibraryStory): string {
    if (entry.reading.status === 'FINISHED') {
      return 'Historia finalizada';
    }

    const currentChapter = this.storyChapterProgress(entry);

    if (currentChapter === null) {
      return 'Todavía no abriste capítulos';
    }

    const totalChapters = entry.story.publishedChaptersCount;

    return totalChapters > 0
      ? `Capítulo ${currentChapter} de ${totalChapters}`
      : `Capítulo ${currentChapter}`;
  }
  readingProgressLabel(reading: ReadingStatus): string | null {
    const percentage = this.readingPercentage(reading);

    if (percentage === null) {
      return null;
    }

    if (
      reading.bookId &&
      reading.progressType === 'CHAPTER' &&
      reading.progressValue != null &&
      reading.progressTotal != null &&
      reading.progressTotal > 0
    ) {
      return `Capítulo ${reading.progressValue} de ${reading.progressTotal}`;
    }

    if (reading.progressType === 'PERCENTAGE') {
      return `${reading.progressValue}%`;
    }

    return null;
  }
  editStatus(entry: LibraryBook | LibraryStory): void {
    if (this.saving()) return;

    this.editing.set(entry);
    this.draftStatus.set(entry.reading.status);

    const isChapterProgress =
      entry.reading.progressType === 'CHAPTER';

    this.progressMode.set(
      isChapterProgress ? 'CHAPTER' : 'PERCENTAGE',
    );

    this.draftPercentage.set(
      entry.reading.progressType === 'PERCENTAGE'
        ? (entry.reading.progressValue?.toString() ?? '')
        : '',
    );

    this.draftChapter.set(
      isChapterProgress
        ? (entry.reading.progressValue?.toString() ?? '')
        : '',
    );

    this.draftTotalChapters.set(
      isChapterProgress
        ? (entry.reading.progressTotal?.toString() ?? '')
        : '',
    );

    this.progressTouched.set(false);
    this.chapterProgressTouched.set(false);
    this.progressModeTouched.set(false);
    this.progressInputValid.set(true);
    this.saveError.set('');
    this.confirmation.set('');
    this.confirmingDelete.set(false);
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
    if (valid && value.trim() !== '' && Number(value) === 100) this.chooseStatus('FINISHED');
  }
  chooseProgressMode(value: string): void {
    if (value !== 'PERCENTAGE' && value !== 'CHAPTER') {
      return;
    }

    this.progressMode.set(value);
    this.progressModeTouched.set(true);
  }

  chooseChapter(value: string): void {
    this.draftChapter.set(value);
    this.chapterProgressTouched.set(true);
  }

  chooseTotalChapters(value: string): void {
    this.draftTotalChapters.set(value);
    this.chapterProgressTouched.set(true);
  }
  readingPercentage(reading: ReadingStatus): number | null {
    if (
      reading.bookId &&
      reading.progressType === 'CHAPTER' &&
      reading.progressValue != null &&
      reading.progressTotal != null &&
      reading.progressTotal > 0
    ) {
      return Math.min(
        100,
        Math.max(0, (reading.progressValue / reading.progressTotal) * 100),
      );
    }

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
  askToRemoveEntry(): void {
    if (this.saving() || !this.editing()) return;
    this.confirmingDelete.set(true);
    this.saveError.set('');
  }
  cancelRemoveBook(): void {
    if (!this.saving()) {
      this.confirmingDelete.set(false);
      this.saveError.set('');
    }
  }
  removeEntryFromLibrary(): void {
    const entry = this.editing();
    if (!entry || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.service
      .removeFromLibrary(entry.reading)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.entries.update((entries) =>
            entries.filter((item) => item.reading.idExternal !== entry.reading.idExternal),
          );
          this.stories.update((stories) =>
            stories.filter((item) => item.reading.idExternal !== entry.reading.idExternal),
          );
          this.saving.set(false);
          this.confirmation.set(`${this.titleOf(entry)} se quitó de tu biblioteca.`);
          this.statusDialog().nativeElement.close();
        },
        error: (error) => {
          this.saveError.set(libraryError(error));
          this.saving.set(false);
        },
      });
  }
  saveStatus(): void {
    const entry = this.editing();
    if (!entry || this.saving() || this.progressError() || !this.hasChanges()) {
      return;
    }

    const progressUpdate = this.progressChanged()
      ? this.progressMode() === 'CHAPTER'
        ? {
            type: 'CHAPTER' as const,
            value: Number(this.draftChapter()),
            total: Number(this.draftTotalChapters()),
          }
        : {
            type: 'PERCENTAGE' as const,
            value: this.percentage(),
          }
      : undefined;

    this.saving.set(true);
    this.saveError.set('');
    this.service
      .updateStatus(
        entry.reading,
        this.draftStatus(),
        progressUpdate,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reading) => {
          this.entries.update((entries) =>
            entries.map((item) =>
              item.reading.idExternal === entry.reading.idExternal ? { ...item, reading } : item,
            ),
          );
          this.stories.update((stories) =>
            stories.map((item) =>
              item.reading.idExternal === entry.reading.idExternal ? { ...item, reading } : item,
            ),
          );
          this.saving.set(false);

          const progressLabel =
            reading.progressType === 'CHAPTER' &&
            reading.progressValue != null
              ? ` · capítulo ${reading.progressValue}${
                  reading.progressTotal != null
                    ? ` de ${reading.progressTotal}`
                    : ''
                }`
              : this.readingPercentage(reading) !== null
                ? ` · ${this.readingPercentage(reading)}%`
                : '';

          this.confirmation.set(
            `${this.titleOf(entry)}: ${this.statusLabel(reading.status)}${progressLabel}.`,
          );
          this.statusDialog().nativeElement.close();
        },
        error: (error) => {
          this.saveError.set(libraryError(error));
          this.saving.set(false);
        },
      });
  }
  readonly colors = ['#42445e', '#93a897', '#766081', '#caa6b4', '#8c9bb9', '#d2ad93'];
  readonly inkColors = ['#e7dab6', '#263c32', '#fff0db', '#4d2b45', '#24324b', '#49352d'];
  readonly libraryBooks = computed(() =>
    this.entries().filter((entry) =>
      this.filter() === 'ABANDONED'
        ? entry.reading.status === 'ABANDONED'
        : entry.reading.status !== 'ABANDONED',
    ),
  );
  readonly libraryStories = computed(() =>
    this.stories().filter((entry) =>
      this.filter() === 'ABANDONED'
        ? entry.reading.status === 'ABANDONED'
        : entry.reading.status !== 'ABANDONED',
    ),
  );
  readonly filteredBooks = computed(() =>
    this.libraryBooks().filter(
      (entry) => this.filter() === 'all' || entry.reading.status === this.filter(),
    ),
  );
  readonly bookShelves = computed(() => this.groupByState(this.filteredBooks()));
  readonly storyShelves = computed(() =>
    this.groupByState(
      this.libraryStories().filter(
        (entry) => this.filter() === 'all' || entry.reading.status === this.filter(),
      ),
    ),
  );
  private groupByState<T extends LibraryBook | LibraryStory>(entries: T[]) {
    const states: readonly ReadingState[] = this.filter() === 'ABANDONED'
      ? ['ABANDONED']
      : this.shelfStates;
    return states
      .map((state) => ({
        state,
        entries: this.sortShelf(entries.filter((entry) => entry.reading.status === state), state),
      }))
      .filter((shelf) => shelf.entries.length > 0);
  }
  private sortShelf<T extends LibraryBook | LibraryStory>(entries: T[], state: ReadingState): T[] {
    const order = this.shelfOrder();
    if (order === 'original') return entries;
    if (order === 'custom') {
      if (!entries.length) return entries;
      const ids = this.customOrders()[this.shelfKey(entries[0], state)] ?? [];
      const positions = new Map(ids.map((id, index) => [id, index]));
      return [...entries].sort((a, b) =>
        (positions.get(a.reading.idExternal) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(b.reading.idExternal) ?? Number.MAX_SAFE_INTEGER),
      );
    }
    const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
    return [...entries].sort((a, b) => {
      if (order === 'progress') {
        const aProgress = this.progressForSort(a.reading);
        const bProgress = this.progressForSort(b.reading);
        if (aProgress === null && bProgress !== null) return 1;
        if (aProgress !== null && bProgress === null) return -1;
        if (aProgress !== null && bProgress !== null && aProgress !== bProgress) {
          return bProgress - aProgress;
        }
      }
      return collator.compare(this.titleOf(a), this.titleOf(b));
    });
  }
  private progressForSort(reading: ReadingStatus): number | null {
    if (reading.status === 'FINISHED') return 100;
    const value = reading.progressValue;
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    if (reading.progressType === 'PERCENTAGE' && value <= 100) return value;
    if (reading.progressType === 'CHAPTER' && reading.progressTotal && reading.progressTotal > 0 && value <= reading.progressTotal) {
      return (value / reading.progressTotal) * 100;
    }
    return null;
  }
  setShelfOrder(value: string): void {
    if (value !== 'original' && value !== 'title' && value !== 'progress' && value !== 'custom') return;
    this.shelfOrder.set(value);
    try {
      const key = this.storageKey();
      if (key) localStorage.setItem(`${key}:selected`, value);
    } catch { /* The current selection still works for this visit. */ }
    for (const shelf of this.shelves()) shelf.nativeElement.scrollLeft = 0;
  }
  private shelfKey(entry: LibraryBook | LibraryStory, state: ReadingState): string {
    return `${'book' in entry ? 'books' : 'stories'}:${state}`;
  }
  private storageKey(): string | null {
    try {
      const id = localStorage.getItem('userId');
      return id ? `bookverse:shelf-order:${id}` : null;
    } catch { return null; }
  }
  private readCustomOrders(): Record<string, string[]> {
    try {
      const key = this.storageKey();
      const data: unknown = key ? JSON.parse(localStorage.getItem(key) ?? '{}') : {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      return Object.fromEntries(Object.entries(data).filter(([, ids]) =>
        Array.isArray(ids) && ids.every((id: unknown) => typeof id === 'string')));
    } catch { return {}; }
  }
  private readShelfOrder(): ShelfOrder {
    try {
      const key = this.storageKey();
      const value = key ? localStorage.getItem(`${key}:selected`) : null;
      return value === 'title' || value === 'progress' || value === 'custom' ? value : 'original';
    } catch { return 'original'; }
  }
  moveWithKeyboard(event: Event, entries: (LibraryBook | LibraryStory)[], state: ReadingState, index: number, direction: number): void {
    if (this.shelfOrder() !== 'custom') return;
    event.preventDefault();
    this.moveEntry(entries, state, index, index + direction);
  }
  moveEntry(entries: (LibraryBook | LibraryStory)[], state: ReadingState, from: number, to: number): void {
    if (this.shelfOrder() !== 'custom' || from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return;
    const ids = entries.map((entry) => entry.reading.idExternal);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    const key = this.shelfKey(entries[0], state);
    this.customOrders.update((orders) => ({ ...orders, [key]: ids }));
    try {
      const storageKey = this.storageKey();
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(this.customOrders()));
    } catch { this.confirmation.set('No pudimos guardar el orden en este navegador.'); }
  }
  startDrag(event: DragEvent, entry: LibraryBook | LibraryStory, state: ReadingState): void {
    if (this.shelfOrder() !== 'custom') return;
    this.dragged = { shelf: this.shelfKey(entry, state), id: entry.reading.idExternal };
    event.dataTransfer?.setData('text/plain', entry.reading.idExternal);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  allowDrop(event: DragEvent, entry: LibraryBook | LibraryStory, state: ReadingState): void {
    if (this.dragged?.shelf === this.shelfKey(entry, state)) event.preventDefault();
  }
  dropEntry(event: DragEvent, entries: (LibraryBook | LibraryStory)[], entry: LibraryBook | LibraryStory, state: ReadingState): void {
    if (!this.dragged || this.dragged.shelf !== this.shelfKey(entry, state)) return;
    event.preventDefault();
    this.moveEntry(entries, state, entries.findIndex((item) => item.reading.idExternal === this.dragged?.id), entries.indexOf(entry));
    this.dragged = null;
  }
  endDrag(): void { this.dragged = null; }
  shelfLabel(state: ReadingState, stories = false): string {
    return state === 'FINISHED'
      ? stories
        ? 'Finalizadas'
        : 'Finalizados'
      : this.statusLabel(state);
  }
  setFilter(value: string): void {
    if (value !== 'all' && !this.readingStates.some((state) => state === value)) return;
    this.filter.set(value);
    for (const shelf of this.shelves()) shelf.nativeElement.scrollLeft = 0;
  }
  ngOnInit(): void {
    this.load();
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.service
      .getMyLibrary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.entries.set(result.entries);
          this.stories.set(result.stories ?? []);
          this.restrictedCount.set(result.restrictedCount ?? 0);
          this.unavailableCount.set(result.unavailableCount);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(libraryError(error));
          this.loading.set(false);
        },
      });
  }
  statusLabel(state: ReadingState): string {
    return readingStateLabel(state);
  }
}
