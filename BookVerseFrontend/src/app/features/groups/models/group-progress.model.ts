export interface GroupProgress {
  groupId: string;
  goalType: 'CHAPTER' | 'PERCENTAGE';
  currentProgress: number;
  targetProgress: number;
  achieved: boolean;
}