import { ReadingState } from './library-book.model';

export const READING_STATES: readonly ReadingState[] = [
  'WANT_TO_READ',
  'IN_PROGRESS',
  'FINISHED',
  'RE_READING',
  'ABANDONED',
];

export const READING_STATE_DETAILS: Record<ReadingState, { label: string; icon: string }> = {
  WANT_TO_READ: { label: 'Quiero leer', icon: 'M6 3h12v18l-6-4-6 4V3Z' },
  IN_PROGRESS: {
    label: 'Leyendo',
    icon: 'M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-1-10 1Zm0 0v16',
  },
  FINISHED: { label: 'Finalizado', icon: 'M9 12l2 2 4-4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
  RE_READING: { label: 'Releyendo', icon: 'M3 11a9 9 0 1 1 2 7M3 3v8h8' },
  ABANDONED: { label: 'Abandonado', icon: 'M8 5v14M16 5v14' },
};

export function readingStateLabel(state: ReadingState): string {
  return READING_STATE_DETAILS[state]?.label ?? 'Sin estado';
}

export function isReadingState(value: string): value is ReadingState {
  return READING_STATES.some((state) => state === value);
}
