export interface ReadingStatusResponse {
  idExternal: string;
  userId: string;
  bookId: string | null;
  storyId: string | null;
  status: string;
  progressType: string | null;
  progressValue: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}