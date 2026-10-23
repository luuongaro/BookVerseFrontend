import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyLibrary } from './my-library';
import { LibraryService } from '../../services/library.service';
import { LibraryResult } from '../../models/library-book.model';
import { HttpErrorResponse } from '@angular/common/http';
describe('Personal bookshelf screen', () => {
  async function setup(result: LibraryResult) {
    const getMyBooks = vi.fn(() => of(result));
    TestBed.configureTestingModule({
      imports: [MyLibrary],
      providers: [provideRouter([]), { provide: LibraryService, useValue: { getMyBooks } }],
    });
    const fixture = TestBed.createComponent(MyLibrary);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, getMyBooks };
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
});
