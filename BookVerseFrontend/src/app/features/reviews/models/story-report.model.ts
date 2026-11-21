export type StoryReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StoryReport {
  reportId: string;
  storyId: string;
  storyTitle: string;
  storyAuthorUsername: string;
  storyModerationRemoved: boolean;
  reporterUserId: string;
  reporterUsername: string | null;
  moderatorUserId: string | null;
  moderatorUsername: string | null;
  restoredByUserId: string | null;
  restoredByUsername: string | null;
  restoredAt: string | null;
  reason: string;
  details: string | null;
  resolutionComment: string | null;
  status: StoryReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateStoryReport {
  storyId: string;
  reason: string;
  details: string | null;
}

export interface StoryReportModeration {
  resolutionComment: string | null;
}
