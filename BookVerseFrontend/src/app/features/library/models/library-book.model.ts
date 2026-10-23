import { Book } from '../../books/models/book.model';
export type ReadingState = 'WANT_TO_READ' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED' | 'RE_READING';
export interface ReadingStatus {
  idExternal: string;
  userId: string;
  bookId: string | null;
  storyId: string | null;
  status: ReadingState;
  progressType: 'PERCENTAGE' | 'CHAPTER' | null;
  progressValue: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
}
export interface LibraryBook {
  book: Book;
  reading: ReadingStatus;
}
export interface LibraryResult {
  entries: LibraryBook[];
  unavailableCount: number;
}
