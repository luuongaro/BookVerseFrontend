import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LibraryService, libraryError } from '../../services/library.service';
import { ReadingState, ReadingStatus } from '../../models/library-book.model';
import { readingStateLabel } from '../../models/reading-state';
import { ReadingStateBadge } from '../reading-state-badge/reading-state-badge';
import { ReadingStateSelect } from '../reading-state-select/reading-state-select';

@Component({
  selector: 'app-library-save-control',
  imports: [RouterLink, ReadingStateBadge, ReadingStateSelect],
  template: `
    <section
      class="library-control"
      aria-label="Estado en mi biblioteca"
      [attr.aria-busy]="loading() || saving()"
    >
      <h2>Mi biblioteca</h2>
      @if (loading()) {
        <p role="status">Consultando tu biblioteca…</p>
      } @else if (lookupError()) {
        <p class="error" role="alert">{{ lookupError() }}</p>
        <button type="button" (click)="load()">Reintentar</button>
      } @else if (reading(); as current) {
        <app-reading-state-badge [state]="current.status" prefix="Estado actual" />
        <a routerLink="/library">Cambiar estado en mi biblioteca</a>
      } @else {
        <app-reading-state-select
          label="Guardar como"
          [value]="selection()"
          [disabled]="saving()"
          (valueChange)="selection.set($event)"
        />
        <button type="button" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Guardando…' : 'Guardar en mi biblioteca' }}
        </button>
      }
      @if (saveError()) {
        <p class="error" role="alert">{{ saveError() }}</p>
      }
      <p class="confirmation" role="status" aria-live="polite">{{ confirmation() }}</p>
    </section>
  `,
  styleUrl: './library-save-control.css',
})
export class LibrarySaveControl {
  readonly contentId = input.required<string>();
  readonly kind = input<'book' | 'story'>('book');
  private readonly library = inject(LibraryService);
  readonly reading = signal<ReadingStatus | null>(null);
  readonly selection = signal<ReadingState>('WANT_TO_READ');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly lookupError = signal('');
  readonly saveError = signal('');
  readonly confirmation = signal('');
  private lookupRequest?: Subscription;
  private saveRequest?: Subscription;

  constructor() {
    effect((cleanup) => {
      this.load();
      cleanup(() => {
        this.lookupRequest?.unsubscribe();
        this.saveRequest?.unsubscribe();
      });
    });
  }

  load(): void {
    const id = this.contentId();
    const kind = this.kind();
    this.lookupRequest?.unsubscribe();
    this.saveRequest?.unsubscribe();
    this.reading.set(null);
    this.selection.set('WANT_TO_READ');
    this.loading.set(true);
    this.saving.set(false);
    this.lookupError.set('');
    this.saveError.set('');
    this.confirmation.set('');
    const request =
      kind === 'book' ? this.library.getBookStatus(id) : this.library.getStoryStatus(id);
    this.lookupRequest = request.subscribe({
      next: (reading) => {
        this.reading.set(reading);
        this.loading.set(false);
      },
      error: (error) => {
        this.lookupError.set(libraryError(error));
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.loading() || this.lookupError() || this.saving() || this.reading()) return;
    this.saving.set(true);
    this.saveError.set('');
    const request =
      this.kind() === 'book'
        ? this.library.saveBook(this.contentId(), this.selection())
        : this.library.saveStory(this.contentId(), this.selection());
    this.saveRequest = request.subscribe({
      next: (reading) => {
        this.reading.set(reading);
        this.saving.set(false);
        this.confirmation.set('En tu biblioteca: ' + readingStateLabel(reading.status) + '.');
      },
      error: (error) => {
        this.saveError.set(libraryError(error));
        this.saving.set(false);
      },
    });
  }
}
