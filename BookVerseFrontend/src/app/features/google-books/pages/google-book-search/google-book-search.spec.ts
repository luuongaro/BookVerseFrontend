import { LibraryService } from '../../../library/services/library.service';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { GoogleBookSearch } from './google-book-search';
import { GoogleBooksService } from '../../services/google-books.service';
import { BooksService } from '../../../books/services/books.service';
import { GoogleBooksResponse } from '../../models/google-book.model';

describe('GoogleBookSearch states', () => {
  function setup() {
    const search = vi.fn(() => of<GoogleBooksResponse>({ items: [] }));
    const importBook = vi.fn();
    const getMyStatuses = vi.fn(() => of([]));
    const saveBookWithKnownStatuses = vi.fn(() => of({ idExternal: 'reading-id' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: GoogleBooksService, useValue: { search } },
        { provide: BooksService, useValue: { importGoogleBook: importBook } },
        { provide: LibraryService, useValue: { getMyStatuses, saveBookWithKnownStatuses } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new GoogleBookSearch());
    page.form.controls.value.setValue('Borges');
    return { page, search, importBook, getMyStatuses, saveBookWithKnownStatuses };
  }
  it('ignores whitespace-only queries', () => {
    const { page, search } = setup();
    page.form.controls.value.setValue('  ');
    page.search();
    expect(search).not.toHaveBeenCalled();
    expect(page.searched()).toBe(false);
  });
  it('uses title as the default search type', () => {
    const { page } = setup();

    expect(page.form.controls.type.value).toBe('title');
  });
  it('normalizes absent search items', () => {
    const { page, search } = setup();
    search.mockReturnValue(of({ items: null }));
    page.search();
    expect(page.loading()).toBe(false);
    expect(page.results()).toEqual([]);
    expect(page.searched()).toBe(true);
  });
  it('treats search 404 as no results and allows retry after network errors', () => {
    const { page, search } = setup();
    search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    page.search();
    expect(page.error()).toBe('');
    expect(page.results()).toEqual([]);
    search.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    page.search();
    expect(page.error()).toContain('conectar');
    expect(page.loading()).toBe(false);
    search.mockReturnValue(of({ items: [] }));
    page.search();
    expect(page.error()).toBe('');
  });
  it('saves the imported book and stays on the search page', () => {
    const { page, importBook, saveBookWithKnownStatuses } = setup();
    importBook.mockReturnValue(of({ idExternal: 'local-id' }));
    page.importBook('google-id');
    expect(saveBookWithKnownStatuses).toHaveBeenCalledWith('local-id', 'WANT_TO_READ', []);
    expect(page.importing()).toBe('');
    expect(page.savedBookIds().has('google-id')).toBe(true);
    expect(page.confirmation()).toContain('seguir agregando');
  });
  it('uses the state selected for each result and prevents changes during import', () => {
    const { page, importBook, saveBookWithKnownStatuses } = setup();
    page.chooseState('first', 'IN_PROGRESS');
    page.chooseState('second', 'FINISHED');
    expect(page.stateFor('first')).toBe('IN_PROGRESS');
    expect(page.stateFor('second')).toBe('FINISHED');
    importBook.mockReturnValue(of({ idExternal: 'second-book' }));
    page.importBook('second');
    expect(saveBookWithKnownStatuses).toHaveBeenCalledWith('second-book', 'FINISHED', []);
    page.importing.set('first');
    page.chooseState('second', 'WANT_TO_READ');
    expect(page.stateFor('second')).toBe('FINISHED');
  });
  it('preserves results when importing fails', () => {
    const { page, importBook } = setup();
    page.results.set([{ id: 'google-id', volumeInfo: { title: 'Ficciones' } }]);
    importBook.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    page.importBook('google-id');
    expect(page.results()).toHaveLength(1);
    expect(page.importing()).toBe('');
    expect(page.importError()).not.toBe('');
  });
  it('keeps the search results and does not claim success if personal saving fails', () => {
    const { page, importBook, saveBookWithKnownStatuses } = setup();
    importBook.mockReturnValue(of({ idExternal: 'local-id' }));
    saveBookWithKnownStatuses.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    page.results.set([{ id: 'google-id', volumeInfo: { title: 'Ficciones' } }]);
    page.importBook('google-id');
    expect(page.results()).toHaveLength(1);
    expect(page.importing()).toBe('');
    expect(page.importError()).not.toBe('');
  });
});
