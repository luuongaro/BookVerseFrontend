export type ReviewReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewReport {
  reportId: string;
  reviewId: string;
  bookId: string | null;
  storyId: string | null;
  workTitle: string | null;
  thumbnailUrl: string | null;
  reviewerName: string | null;
  rating: number | null;
  reviewContent: string | null;
  reporterUserId: string;
  reporterUsername: string | null;
  moderatorUserId: string | null;
  reason: string;
  details: string | null;
  resolutionComment: string | null;
  status: ReviewReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateReviewReport {
  reviewId: string;
  reporterUserId: string;
  reason: string;
  details: string | null;
}

export interface ReviewReportModeration {
  resolutionComment: string | null;
}
