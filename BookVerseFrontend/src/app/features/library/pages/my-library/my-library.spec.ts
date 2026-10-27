import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { MyLibrary } from './my-library';
import { LibraryService } from '../../services/library.service';
import { LibraryResult } from '../../models/library-book.model';
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
  async function setup(result: LibraryResult) {
    TestBed.resetTestingModule();
    const updateStatus = vi.fn();
    const getMyBooks = vi.fn(() => of(result));
    TestBed.configureTestingModule({
      imports: [MyLibrary],
      providers: [
        provideRouter([]),
        { provide: LibraryService, useValue: { getMyBooks, updateStatus } },
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
    expect(updateStatus).toHaveBeenCalledWith(entry.reading, 'FINISHED');
    expect(component.entries()[0].reading.status).toBe('WANT_TO_READ');
    pending.next({ ...entry.reading, status: 'FINISHED' });
    pending.complete();
    fixture.detectChanges();
    expect(component.shelves()).toEqual([]);
    component.filter.set('FINISHED');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.book-spine')).toHaveLength(1);
    expect(component.confirmation()).toBe('Mi libro: Leído.');
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
});
