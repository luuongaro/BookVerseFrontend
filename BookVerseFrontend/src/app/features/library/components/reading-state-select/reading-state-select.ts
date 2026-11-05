import { Component, computed, input, output } from '@angular/core';
import { ReadingState } from '../../models/library-book.model';
import { READING_STATES, READING_STATE_DETAILS, isReadingState } from '../../models/reading-state';

let nextId = 0;
@Component({
  selector: 'app-reading-state-select',
  host: { '[attr.data-state]': 'value()' },
  template: `
    <label [attr.for]="controlId()">{{ label() }}</label>
    <div class="select-row">
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
      <select
        [id]="controlId()"
        #selection
        [disabled]="disabled()"
        (change)="choose(selection.value)"
      >
        @for (state of states; track state) {
          <option [value]="state" [selected]="state === value()">{{ details[state].label }}</option>
        }
      </select>
    </div>
  `,
  styleUrl: './reading-state-select.css',
})
export class ReadingStateSelect {
  readonly value = input<ReadingState>('WANT_TO_READ');
  readonly label = input('Estado de lectura');
  readonly controlId = input('reading-state-' + nextId++);
  readonly disabled = input(false);
  readonly valueChange = output<ReadingState>();
  readonly states = READING_STATES;
  readonly details = READING_STATE_DETAILS;
  readonly icon = computed(() => this.details[this.value()]?.icon ?? '');
  choose(value: string): void {
    if (!this.disabled() && isReadingState(value)) this.valueChange.emit(value);
  }
}
