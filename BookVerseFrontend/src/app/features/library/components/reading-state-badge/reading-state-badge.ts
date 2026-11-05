import { Component, computed, input } from '@angular/core';
import { ReadingState } from '../../models/library-book.model';
import { READING_STATE_DETAILS, readingStateLabel } from '../../models/reading-state';

@Component({
  selector: 'app-reading-state-badge',
  host: { '[attr.data-state]': 'state()' },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="icon()" />
    </svg>
    @if (prefix()) {
      <span class="prefix">{{ prefix() + ': ' }}</span>
    }
    <strong>{{ label() }}</strong>
  `,
  styleUrl: './reading-state-badge.css',
})
export class ReadingStateBadge {
  readonly state = input.required<ReadingState>();
  readonly prefix = input('');
  readonly label = computed(() => readingStateLabel(this.state()));
  readonly icon = computed(() => READING_STATE_DETAILS[this.state()]?.icon ?? '');
}
