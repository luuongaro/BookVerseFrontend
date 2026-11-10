export interface ReadingGroup {
  idExternal: string;
  createdByUserId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReadingGroupRequest {
  name: string;
}

export interface UpdateReadingGroupRequest {
  name: string;
}

export type GroupReadingCycleStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface GroupReadingCycle {
  idExternal: string;
  groupId: string;
  bookId: string | null;
  storyId: string | null;
  editionReference: string | null;
  totalChapters: number | null;
  status: GroupReadingCycleStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateGroupReadingCycleRequest {
  bookId?: string | null;
  storyId?: string | null;
  editionReference?: string | null;
  totalChapters?: number | null;
}

export interface UpdateGroupReadingCycleBookReferenceRequest {
  editionReference: string;
  totalChapters: number;
}

export type GroupReadingParticipantStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'WITHDRAWN';

export interface GroupReadingParticipant {
  idExternal: string;
  readingCycleId: string;
  groupId: string;
  groupMemberId: string;
  userId: string;
  userName: string;
  status: GroupReadingParticipantStatus;
  joinedAt: string;
  completedAt: string | null;
}
