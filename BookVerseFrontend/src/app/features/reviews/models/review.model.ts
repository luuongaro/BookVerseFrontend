export interface Review {
  reviewId: string;
  reviewerId: string;
  reviewerName?: string | null;
  bookId: string | null;
  storyId: string | null;
  rating: number;
  content: string;
  deleted: boolean;
  takedownStatus: 'ACTIVE' | 'TAKEN_DOWN' | 'RESTORED';
  takedownAt: string | null;
  takedownReason: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewContent {
  rating: number;
  content: string;
}
export interface CreateReview extends ReviewContent {
  reviewerId: string;
  bookId: string | null;
  storyId: string | null;
}
