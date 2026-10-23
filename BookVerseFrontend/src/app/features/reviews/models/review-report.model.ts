export type ReviewReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewReport {
  reportId: string;
  reviewId: string;
  reporterUserId: string;
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
