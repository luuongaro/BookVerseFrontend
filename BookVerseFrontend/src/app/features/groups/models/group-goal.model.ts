
export interface GroupGoal {
  idExternal: string;
  groupId: string;
  readingCycleId: string | null;
  goalType: string;
  status: string;
  targetProgress: number;
  targetDate: string;
  updatedAt: string;
}
