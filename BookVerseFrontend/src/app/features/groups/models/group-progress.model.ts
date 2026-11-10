export interface GroupProgress {
  groupId: string;
  readingCycleId: string;
  goalType: 'CHAPTER' | 'PERCENTAGE';
  currentProgress: number;
  targetProgress: number;
  achieved: boolean;
}
