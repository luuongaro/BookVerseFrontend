import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BookDetail } from './book-detail';
import { BooksService } from '../../services/books.service';
import { LibraryService } from '../../../library/services/library.service';

describe('Book description rendering', () => {
  function render(description: string | null) {
    TestBed.configureTestingModule({
      imports: [BookDetail],
      providers: [
        provideRouter([]),
        {
          provide: BooksService,
          useValue: { getById: () => of({ idExternal: 'book', title: 'Libro', description }) },
        },
        { provide: LibraryService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(BookDetail);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.prose') as HTMLElement;
  }

  it('renders paragraphs, emphasis and line breaks instead of literal HTML tags', () => {
    const description = render('<b>Resumen</b><br>Otra línea<p>Un párrafo.</p>');
    expect(description.querySelector('b')?.textContent).toBe('Resumen');
    expect(description.querySelector('br')).not.toBeNull();
    expect(description.querySelector('p')?.textContent).toBe('Un párrafo.');
    expect(description.textContent).not.toContain('<b>');
  });

  it('sanitizes scripts and event handlers from external descriptions', () => {
    const description = render(
      '<script>alert(1)</script><img src="cover.jpg" onerror="alert(1)"><b onclick="alert(1)">Resumen</b>',
    );
    expect(description.querySelector('script')).toBeNull();
    expect(description.querySelector('[onerror], [onclick]')).toBeNull();
    expect(description.querySelector('b')?.textContent).toBe('Resumen');
  });

  it('shows a fallback when the book has no description', () => {
    expect(render(null).textContent).toBe('Sin descripción.');
  });
});
