export type GroupCommentProgressType = 'CHAPTER' | 'PERCENTAGE';

export interface GroupComment {
  idExternal: string;
  groupId: string;
  readingCycleId: string;
  userId: string;
  userName: string;
  content: string;
  progressType: GroupCommentProgressType;
  progressValue: number;
  createdAt: string;
}

export interface GroupCommentsVisibility {
  comments: GroupComment[];
  totalActiveComments: number;
  visibleCount: number;
  hiddenByProgressCount: number;
}

export interface CreateGroupCommentRequest {
  content: string;
  progressType: GroupCommentProgressType;
  progressValue: number;
}
