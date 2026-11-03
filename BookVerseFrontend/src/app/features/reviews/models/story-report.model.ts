export type StoryReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StoryReport {
  reportId: string;
  storyId: string;
  storyTitle: string;
  storyAuthorUsername: string;
  reporterUserId: string;
  reporterUsername: string | null;
  moderatorUserId: string | null;
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
