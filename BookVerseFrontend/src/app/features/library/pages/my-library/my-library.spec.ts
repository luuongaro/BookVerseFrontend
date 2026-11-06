import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { MyLibrary } from './my-library';
import { LibraryService } from '../../services/library.service';
import { LibraryResult, LibraryStory } from '../../models/library-book.model';
import { StoryAccessType } from '../../../stories/models/story-access-type';
import { HttpErrorResponse } from '@angular/common/http';
function savedEntry(): LibraryResult['entries'][number] {
  return {
    book: {
      idExternal: 'saved',
      title: 'Mi libro',
      authors: ['Autora'],
      googleBookId: 'google',
      description: null,
      isbn: null,
      thumbnailUrl: null,
      publisher: null,
      publishedDate: null,
      language: null,
      categories: null,
      readingGroupsCount: 0,
      readingStatusesCount: 1,
    },
    reading: {
      idExternal: 'reading',
      userId: 'user',
      bookId: 'saved',
      storyId: null,
      status: 'WANT_TO_READ',
      progressType: null,
      progressValue: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: null,
    },
  };
}
describe('Personal bookshelf screen', () => {
  async function setup(result: LibraryResult, savedId: string | null = null) {
    TestBed.resetTestingModule();
    const updateStatus = vi.fn();
    const getMyBooks = vi.fn(() => of(result));
    TestBed.configureTestingModule({
      imports: [MyLibrary],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap(savedId ? { saved: savedId } : {})) },
        },
        { provide: LibraryService, useValue: { getMyLibrary: getMyBooks, updateStatus } },
      ],
    });
    const fixture = TestBed.createComponent(MyLibrary);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    };
    await fixture.whenStable();
    return { fixture, getMyBooks, updateStatus };
  }
  it('shows a personal empty shelf and a catalog link without fabricated book titles', async () => {
    const { fixture } = await setup({ entries: [], unavailableCount: 0 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tu estantería empieza con un libro.');
    expect(el.querySelector('.shelf-room')).not.toBeNull();
    expect(el.querySelectorAll('.book-spine')).toHaveLength(0);
    expect(el.querySelector('a[href="/books"]')).not.toBeNull();
  });
  it('shows the server state of the imported reading rather than an assumed default', async () => {
    const entry = savedEntry();
    entry.reading.status = 'IN_PROGRESS';
    const { fixture } = await setup({ entries: [entry], unavailableCount: 0 }, 'reading');
    const banner: HTMLElement = fixture.nativeElement.querySelector('.added-reading');
    expect(banner.textContent).toContain('Mi libro');
    expect(banner.querySelector('app-reading-state-badge')?.getAttribute('data-state')).toBe(
      'IN_PROGRESS',
    );
    expect(banner.textContent).toContain('Estado actual: Leyendo');
  });
  it('does not claim a reading was saved if the requested record is not in the library', async () => {
    const { fixture } = await setup({ entries: [savedEntry()], unavailableCount: 0 }, 'missing');
    expect(fixture.nativeElement.querySelector('.added-reading')).toBeNull();
  });
  it('keeps the saved state visible while another state is only a draft', async () => {
    const entry = savedEntry();
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    fixture.componentInstance.editStatus(entry);
    fixture.componentInstance.chooseStatus('FINISHED');
    fixture.detectChanges();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('dialog');
    expect(dialog.querySelector('app-reading-state-badge')?.getAttribute('data-state')).toBe(
      'WANT_TO_READ',
    );
    expect((dialog.querySelector('#book-reading-status') as HTMLSelectElement).value).toBe(
      'FINISHED',
    );
    expect(updateStatus).not.toHaveBeenCalled();
  });
  it('renders saved books and filters by reading status', async () => {
    const entries = [
      {
        book: { idExternal: 'saved', title: 'Mi libro guardado', authors: ['Autora'] },
        reading: { idExternal: 'reading', status: 'WANT_TO_READ' },
      },
    ] as LibraryResult['entries'];
    const { fixture } = await setup({ entries, unavailableCount: 0 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.book-spine')).toHaveLength(1);
    expect(el.querySelector('.book-spine')?.getAttribute('href')).toBe('/books/saved');
    fixture.componentInstance.filter.set('FINISHED');
    fixture.detectChanges();
    expect(el.querySelectorAll('.book-spine')).toHaveLength(0);
    expect(el.textContent).toContain('Todavía no tenés libros en este estado.');
  });
  it('keeps only the title on the spine and edits the state from its separate label', async () => {
    const entry = savedEntry();
    entry.book.title = 'Un título largo que necesita más de una línea en el lomo';
    entry.reading.status = 'IN_PROGRESS';
    entry.reading.progressType = 'PERCENTAGE';
    entry.reading.progressValue = 45;
    const { fixture } = await setup({ entries: [entry], unavailableCount: 0 });
    const el: HTMLElement = fixture.nativeElement;
    const spine = el.querySelector<HTMLAnchorElement>('.book-spine')!;
    const label = el.querySelector<HTMLButtonElement>('.edit-status')!;

    expect(spine.textContent?.trim()).toBe(entry.book.title);
    expect(spine.querySelector('.spine-status, .spine-progress, .spine-mark')).toBeNull();
    expect(label.parentElement).toBe(spine.parentElement);
    expect(label.getAttribute('data-state')).toBe('IN_PROGRESS');
    expect(label.textContent).toContain('Leyendo');
    expect(label.textContent).toContain('45%');
    expect(label.getAttribute('aria-describedby')).toBe(label.querySelector('.status-label')!.id);
    label.click();
    fixture.detectChanges();
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(el.querySelector('.selected-title')?.textContent).toBe(entry.book.title);
  });
  it('keeps more than two former rows of books in one shelf and allows editing the last book', async () => {
    const entries = Array.from({ length: 22 }, (_, i) => {
      const entry = savedEntry();
      return {
        book: { ...entry.book, idExternal: `book-${i}`, title: `Libro ${i + 1}` },
        reading: { ...entry.reading, idExternal: `reading-${i}`, bookId: `book-${i}` },
      };
    });
    const { fixture } = await setup({ entries, unavailableCount: 0 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.book-shelf-room .shelf-section')).toHaveLength(1);
    expect(el.querySelectorAll('.book-shelf-room .wood-shelf')).toHaveLength(1);
    expect(el.querySelectorAll('.book-shelf-room .book-spine')).toHaveLength(22);
    expect(el.querySelector('.shelf-scroll')?.getAttribute('tabindex')).toBe('0');
    expect(el.querySelector('a[href="/books/book-21"]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('[aria-label="Cambiar estado de Libro 22"]')!.click();
    fixture.detectChanges();

    expect(el.querySelector('.selected-title')?.textContent).toBe('Libro 22');
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });
  it('returns to the start of the shelf when the reading filter changes', async () => {
    const first = savedEntry();
    const second = {
      book: { ...first.book, idExternal: 'second', title: 'Otro libro' },
      reading: {
        ...first.reading,
        idExternal: 'second-reading',
        bookId: 'second',
        status: 'IN_PROGRESS' as const,
      },
    };
    const { fixture } = await setup({ entries: [first, second], unavailableCount: 0 });
    const el: HTMLElement = fixture.nativeElement;
    const shelf = el.querySelector<HTMLDivElement>('.shelf-scroll')!;
    shelf.scrollLeft = 400;
    const filter = el.querySelector<HTMLSelectElement>('#reading-filter')!;
    filter.value = 'IN_PROGRESS';
    filter.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(shelf.scrollLeft).toBe(0);
    expect(el.querySelectorAll('.book-shelf-room .book-spine')).toHaveLength(1);
    expect(el.querySelector('.book-shelf-room .book-spine')?.getAttribute('href')).toBe(
      '/books/second',
    );
  });
  it('allows retry after a network failure', async () => {
    const { fixture, getMyBooks } = await setup({ entries: [], unavailableCount: 0 });
    getMyBooks.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos conectar');
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tu estantería empieza con un libro.');
  });
  it('saves a new state, refreshes the shelf filters and prevents duplicate submits', async () => {
    const entry = savedEntry();
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    const pending = new Subject<typeof entry.reading>();
    updateStatus.mockReturnValue(pending);
    component.filter.set('WANT_TO_READ');
    component.editStatus(entry);
    fixture.detectChanges();
    component.chooseStatus('FINISHED');
    component.saveStatus();
    component.saveStatus();
    expect(updateStatus).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith(entry.reading, 'FINISHED', undefined);
    expect(component.entries()[0].reading.status).toBe('WANT_TO_READ');
    pending.next({ ...entry.reading, status: 'FINISHED' });
    pending.complete();
    fixture.detectChanges();
    expect(component.filteredBooks()).toEqual([]);
    component.filter.set('FINISHED');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.book-spine')).toHaveLength(1);
    expect(component.confirmation()).toBe('Mi libro: Finalizado.');
  });
  it('keeps the original state on error, lets the user retry and makes cancel a no-op', async () => {
    const entry = savedEntry();
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    component.closeEditor();
    expect(updateStatus).not.toHaveBeenCalled();
    component.editStatus(entry);
    component.chooseStatus('IN_PROGRESS');
    updateStatus.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    component.saveStatus();
    fixture.detectChanges();
    expect(component.entries()[0].reading.status).toBe('WANT_TO_READ');
    expect(fixture.nativeElement.textContent).toContain('No tenés permiso');
    updateStatus.mockReturnValueOnce(of({ ...entry.reading, status: 'IN_PROGRESS' }));
    component.saveStatus();
    expect(component.entries()[0].reading.status).toBe('IN_PROGRESS');
  });
  it('saves progress without requiring a status change and shows the server result on the separate state label', async () => {
    const entry = savedEntry();
    entry.reading = {
      ...entry.reading,
      status: 'IN_PROGRESS',
      progressType: 'PERCENTAGE',
      progressValue: 20,
    };
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '#book-reading-percentage',
    ) as HTMLInputElement;
    expect(input.value).toBe('20');
    expect(component.hasChanges()).toBe(false);
    input.value = '45';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const pending = new Subject<typeof entry.reading>();
    updateStatus.mockReturnValue(pending);
    component.saveStatus();
    component.saveStatus();
    expect(updateStatus).toHaveBeenCalledExactlyOnceWith(entry.reading, 'IN_PROGRESS', 45);
    expect(component.entries()[0].reading.progressValue).toBe(20);
    pending.next({ ...entry.reading, progressValue: 45 });
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.spine-status').textContent).toContain('45%');
    expect(
      fixture.nativeElement.querySelector('.book-spine').getAttribute('aria-describedby'),
    ).toBe(fixture.nativeElement.querySelector('.status-label').id);
    expect(component.confirmation()).toBe('Mi libro: Leyendo · 45%.');
    component.editStatus(component.entries()[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#book-reading-percentage').value).toBe('45');
  });
  it.each(['-1', '101', '12.5', 'not-a-number'])(
    'rejects invalid progress %s without submitting',
    async (value) => {
      const entry = savedEntry();
      entry.reading.status = 'IN_PROGRESS';
      const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
      const component = fixture.componentInstance;
      component.editStatus(entry);
      component.choosePercentage(value);
      fixture.detectChanges();
      component.saveStatus();
      expect(updateStatus).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('#percentage-error').textContent).toContain(
        'entre 0 y 100',
      );
      expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    },
  );
  it('does not interpret an invalid number input as clearing progress', async () => {
    const entry = savedEntry();
    entry.reading.status = 'IN_PROGRESS';
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    component.choosePercentage('', false);
    component.saveStatus();
    expect(component.progressError()).not.toBe('');
    expect(updateStatus).not.toHaveBeenCalled();
  });
  it.each(['0', ''])(
    'clears existing progress with %s while keeping the reading state',
    async (value) => {
      const entry = savedEntry();
      entry.reading = {
        ...entry.reading,
        status: 'IN_PROGRESS',
        progressType: 'PERCENTAGE',
        progressValue: 60,
      };
      const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
      const component = fixture.componentInstance;
      component.editStatus(entry);
      component.choosePercentage(value);
      updateStatus.mockReturnValue(
        of({ ...entry.reading, progressType: null, progressValue: null }),
      );
      component.saveStatus();
      fixture.detectChanges();
      expect(updateStatus).toHaveBeenCalledWith(entry.reading, 'IN_PROGRESS', null);
      expect(fixture.nativeElement.querySelector('.spine-progress')).toBeNull();
      expect(component.entries()[0].reading.progressValue).toBeNull();
    },
  );
  it('keeps unsaved progress on failure for retry, and resets it after cancellation', async () => {
    const entry = savedEntry();
    entry.reading.status = 'IN_PROGRESS';
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    component.choosePercentage('100');
    updateStatus.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.saveStatus();
    expect(component.entries()[0].reading.progressValue).toBeNull();
    expect(component.draftPercentage()).toBe('100');
    expect(component.saveError()).not.toBe('');
    updateStatus.mockReturnValueOnce(
      of({ ...entry.reading, progressType: 'PERCENTAGE', progressValue: 100 }),
    );
    component.saveStatus();
    expect(component.entries()[0].reading.progressValue).toBe(100);
    component.editStatus(component.entries()[0]);
    component.choosePercentage('30');
    component.closeEditor();
    component.editStatus(component.entries()[0]);
    expect(component.draftPercentage()).toBe('100');
    expect(component.hasChanges()).toBe(false);
  });
  it('preserves chapter progress when only the status is edited', async () => {
    const entry = savedEntry();
    entry.reading = { ...entry.reading, progressType: 'CHAPTER', progressValue: 7 };
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    component.chooseStatus('IN_PROGRESS');
    updateStatus.mockReturnValue(of({ ...entry.reading, status: 'IN_PROGRESS' }));
    component.saveStatus();
    expect(updateStatus).toHaveBeenCalledWith(entry.reading, 'IN_PROGRESS', undefined);
    expect(component.entries()[0].reading.progressType).toBe('CHAPTER');
    expect(component.entries()[0].reading.progressValue).toBe(7);
  });
  it('only offers and displays percentage for Leyendo or Releyendo', async () => {
    const entry = savedEntry();
    entry.reading = { ...entry.reading, progressType: 'PERCENTAGE', progressValue: 25 };
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.spine-status')?.textContent).not.toContain('%');
    component.editStatus(entry);
    fixture.detectChanges();
    expect(el.querySelector('#book-reading-percentage')).toBeNull();
    for (const state of ['IN_PROGRESS', 'RE_READING'] as const) {
      component.chooseStatus(state);
      fixture.detectChanges();
      expect((el.querySelector('#book-reading-percentage') as HTMLInputElement).value).toBe('25');
    }
    for (const state of ['WANT_TO_READ', 'FINISHED', 'ABANDONED'] as const) {
      component.chooseStatus(state);
      fixture.detectChanges();
      expect(el.querySelector('#book-reading-percentage')).toBeNull();
      expect(component.readingPercentage({ ...entry.reading, status: state })).toBeNull();
    }
    expect(updateStatus).not.toHaveBeenCalled();
  });
  it('does not send hidden percentage edits or block a state change with a hidden error', async () => {
    const entry = savedEntry();
    entry.reading = {
      ...entry.reading,
      status: 'IN_PROGRESS',
      progressType: 'PERCENTAGE',
      progressValue: 40,
    };
    const { fixture, updateStatus } = await setup({ entries: [entry], unavailableCount: 0 });
    const component = fixture.componentInstance;
    component.editStatus(entry);
    component.choosePercentage('105');
    expect(component.progressError()).not.toBe('');
    component.chooseStatus('FINISHED');
    fixture.detectChanges();
    expect(component.progressError()).toBe('');
    updateStatus.mockReturnValue(of({ ...entry.reading, status: 'FINISHED' }));
    component.saveStatus();
    fixture.detectChanges();
    expect(updateStatus).toHaveBeenCalledWith(entry.reading, 'FINISHED', undefined);
    expect(fixture.nativeElement.querySelector('.spine-status').textContent).not.toContain('%');
    expect(fixture.nativeElement.querySelector('.spine-progress')).toBeNull();
  });
  it('separates stories into the lighter shelf with story links and applies the status filter', async () => {
    const saved = savedEntry();
    const story: LibraryStory = {
      story: {
        idExternal: 'story-id',
        authorId: 'author',
        authorUsername: 'Autora',
        title: 'Historia guardada',
        description: 'Descripción',
        accessType: StoryAccessType.FREE,
        hidden: false,
        deleted: false,
        createdAt: '',
        updatedAt: '',
        chaptersCount: 4,
        publishedChaptersCount: 4,
        chapters: [],
      },
      reading: {
        ...saved.reading,
        idExternal: 'story-reading',
        bookId: null,
        storyId: 'story-id',
        status: 'IN_PROGRESS',
        progressType: 'CHAPTER',
        progressValue: 2,
      },
    };
    const { fixture, updateStatus } = await setup({
      entries: [saved],
      stories: [story],
      unavailableCount: 0,
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.story-shelf-room .story-spine')?.getAttribute('href')).toBe(
      '/stories/story-id',
    );
    expect(el.querySelectorAll('.story-shelf-room .story-spine')).toHaveLength(1);
    expect(
      el.querySelector('.shelf-room:not(.story-shelf-room) .book-spine')?.getAttribute('href'),
    ).toBe('/books/saved');
    fixture.componentInstance.filter.set('FINISHED');
    fixture.detectChanges();
    expect(el.querySelectorAll('.story-spine')).toHaveLength(0);
    fixture.componentInstance.filter.set('all');
    fixture.componentInstance.editStatus(story);
    fixture.detectChanges();
    expect(el.querySelector('.selected-title')?.textContent).toBe('Historia guardada');
    expect(el.querySelector('#book-reading-percentage')).toBeNull();
    fixture.componentInstance.chooseStatus('FINISHED');
    updateStatus.mockReturnValueOnce(of({ ...story.reading, status: 'FINISHED' }));
    fixture.componentInstance.saveStatus();
    expect(updateStatus).toHaveBeenCalledWith(story.reading, 'FINISHED', undefined);
    expect(fixture.componentInstance.stories()[0].reading.progressValue).toBe(2);
    expect(fixture.componentInstance.entries()[0].reading.status).toBe('WANT_TO_READ');
  });
});
