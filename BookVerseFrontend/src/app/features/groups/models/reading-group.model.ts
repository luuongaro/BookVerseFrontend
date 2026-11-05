export interface ReadingGroup {
  idExternal: string;
  bookId: string | null;
  storyId: string | null;
  createdByUserId: string;
  name: string;
  totalChapters: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReadingGroupRequest {
  bookId?: string | null;
  storyId?: string | null;
  name: string;
}

export interface UpdateReadingGroupRequest {
  name: string;
  totalChapters?: number | null;
}
