export interface ReadingStatusRequest {
  bookId: string | null;
  storyId: string | null;
  status: 'IN_PROGRESS' | 'RE_READING';
  startedAt: string | null;
  finishedAt: string | null;
  progressType: 'CHAPTER';
  progressValue: number;
}
