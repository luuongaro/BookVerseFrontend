import { Component, input, signal } from '@angular/core';
@Component({
  selector: 'app-book-cover',
  templateUrl: './book-cover.html',
  styleUrl: './book-cover.css',
})
export class BookCover {
  src = input<string | null | undefined>(null);
  title = input.required<string>();
  failedSrc = signal<string | null | undefined>(null);
}
