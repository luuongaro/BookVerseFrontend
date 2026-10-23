import { LibraryService } from '../../../library/services/library.service';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
    const navigate = vi.fn();
    const saveBook = vi.fn(() => of({ idExternal: 'reading-id' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: GoogleBooksService, useValue: { search } },
        { provide: BooksService, useValue: { importGoogleBook: importBook } },
        { provide: Router, useValue: { navigate } },
        { provide: LibraryService, useValue: { saveBook } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new GoogleBookSearch());
    page.form.controls.value.setValue('Borges');
    return { page, search, importBook, saveBook, navigate };
  }
  it('ignores whitespace-only queries', () => {
    const { page, search } = setup();
    page.form.controls.value.setValue('  ');
    page.search();
    expect(search).not.toHaveBeenCalled();
    expect(page.searched()).toBe(false);
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
  it('saves the imported book for the user before opening the personal library', () => {
    const { page, importBook, saveBook, navigate } = setup();
    importBook.mockReturnValue(of({ idExternal: 'local-id' }));
    page.importBook('google-id');
    expect(saveBook).toHaveBeenCalledWith('local-id');
    expect(navigate).toHaveBeenCalledWith(['/library']);
    expect(page.importing()).toBe('');
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
    const { page, importBook, saveBook, navigate } = setup();
    importBook.mockReturnValue(of({ idExternal: 'local-id' }));
    saveBook.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    page.results.set([{ id: 'google-id', volumeInfo: { title: 'Ficciones' } }]);
    page.importBook('google-id');
    expect(navigate).not.toHaveBeenCalled();
    expect(page.results()).toHaveLength(1);
    expect(page.importing()).toBe('');
    expect(page.importError()).not.toBe('');
  });
});
