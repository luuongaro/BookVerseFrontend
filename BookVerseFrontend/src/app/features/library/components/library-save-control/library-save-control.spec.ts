import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { LibrarySaveControl } from './library-save-control';
import { LibraryService } from '../../services/library.service';
import { ReadingStatus } from '../../models/library-book.model';

const reading: ReadingStatus = {
  idExternal: 'reading',
  userId: 'user',
  bookId: 'book',
  storyId: null,
  status: 'IN_PROGRESS',
  progressType: 'PERCENTAGE',
  progressValue: 40,
  startedAt: null,
  finishedAt: null,
  updatedAt: null,
};

describe('Library save control', () => {
  async function setup(kind: 'book' | 'story' = 'book', existing: ReadingStatus | null = null) {
    const getBookStatus = vi.fn(() => of<ReadingStatus | null>(existing));
    const getStoryStatus = vi.fn(() => of<ReadingStatus | null>(existing));
    const saveBook = vi.fn(() => of<ReadingStatus>(reading));
    const saveStory = vi.fn(() =>
      of<ReadingStatus>({ ...reading, bookId: null, storyId: 'story' }),
    );
    TestBed.configureTestingModule({
      imports: [LibrarySaveControl],
      providers: [
        provideRouter([]),
        {
          provide: LibraryService,
          useValue: { getBookStatus, getStoryStatus, saveBook, saveStory },
        },
      ],
    });
    const fixture = TestBed.createComponent(LibrarySaveControl);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('contentId', kind);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      page: fixture.componentInstance,
      getBookStatus,
      getStoryStatus,
      saveBook,
      saveStory,
    };
  }

  it('shows the default state before saving and keeps all backend states available', async () => {
    const { fixture, page } = await setup();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('WANT_TO_READ');
    expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
      'Quiero leer',
      'Leyendo',
      'Finalizado',
      'Releyendo',
      'Abandonado',
    ]);
    expect(page.reading()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Guardar como');
  });

  it.each(['book', 'story'] as const)(
    'sends the selected state when saving a new %s',
    async (kind) => {
      const { fixture, page, saveBook, saveStory } = await setup(kind);
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      select.value = 'FINISHED';
      select.dispatchEvent(new Event('change'));
      page.save();
      expect(kind === 'book' ? saveBook : saveStory).toHaveBeenCalledExactlyOnceWith(
        kind,
        'FINISHED',
      );
    },
  );

  it('loads and displays the actual saved state without replacing existing progress', async () => {
    const { fixture, page, saveBook } = await setup('book', reading);
    expect(fixture.nativeElement.textContent).toContain('Estado actual: Leyendo');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    page.save();
    expect(saveBook).not.toHaveBeenCalled();
    expect(page.reading()?.progressValue).toBe(40);
  });

  it('waits for the server, prevents duplicate submissions and displays its returned state', async () => {
    const { fixture, page, saveBook } = await setup();
    const response = new Subject<ReadingStatus>();
    saveBook.mockReturnValue(response);
    page.selection.set('FINISHED');
    page.save();
    page.save();
    fixture.detectChanges();
    expect(saveBook).toHaveBeenCalledTimes(1);
    expect(page.reading()).toBeNull();
    expect(fixture.nativeElement.querySelector('select').disabled).toBe(true);
    response.next(reading);
    fixture.detectChanges();
    expect(page.confirmation()).toBe('En tu biblioteca: Leyendo.');
    expect(fixture.nativeElement.textContent).toContain('Estado actual: Leyendo');
    expect(fixture.nativeElement.textContent).not.toContain('Finalizado');
  });

  it('blocks saving if the current state cannot be loaded and supports retry', async () => {
    const { fixture, page, getBookStatus, saveBook } = await setup();
    getBookStatus.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    page.load();
    page.save();
    fixture.detectChanges();
    expect(saveBook).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    page.load();
    fixture.detectChanges();
    expect(page.lookupError()).toBe('');
    expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
  });

  it('keeps a failed save unconfirmed and preserves the selected state for retry', async () => {
    const { fixture, page, saveBook } = await setup();
    saveBook.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    page.selection.set('FINISHED');
    page.save();
    fixture.detectChanges();
    expect(page.reading()).toBeNull();
    expect(page.selection()).toBe('FINISHED');
    expect(fixture.nativeElement.querySelector('app-reading-state-badge')).toBeNull();
    expect(page.saveError()).not.toBe('');
    page.save();
    expect(page.saveError()).toBe('');
    expect(page.reading()).toEqual(reading);
  });

  it('cancels pending writes when navigating to another book', async () => {
    const { fixture, page, saveBook, getBookStatus } = await setup();
    const pending = new Subject<ReadingStatus>();
    saveBook.mockReturnValue(pending);
    page.save();
    getBookStatus.mockReturnValue(
      of({ ...reading, idExternal: 'other-reading', bookId: 'other-book', status: 'FINISHED' }),
    );
    fixture.componentRef.setInput('contentId', 'other-book');
    fixture.detectChanges();
    await fixture.whenStable();
    pending.next(reading);
    expect(page.reading()?.bookId).toBe('other-book');
    expect(page.reading()?.status).toBe('FINISHED');
    expect(page.saving()).toBe(false);
  });

  it('cancels outdated lookups instead of displaying another book’s status', async () => {
    const { fixture, page, getBookStatus } = await setup();
    const pending = new Subject<ReadingStatus | null>();
    getBookStatus.mockReturnValueOnce(pending);
    page.load();
    fixture.componentRef.setInput('contentId', 'other-book');
    fixture.detectChanges();
    await fixture.whenStable();
    pending.next(reading);
    expect(page.reading()).toBeNull();
    expect(getBookStatus).toHaveBeenLastCalledWith('other-book');
  });
});
