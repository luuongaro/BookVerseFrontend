export interface GroupComment {
  idExternal: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  progressPercent: number;
  createdAt: string;
}

export interface CreateGroupCommentRequest {
  content: string;
  progressPercent: number;
}