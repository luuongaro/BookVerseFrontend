export interface TipResponse {
  idExternal: string;
  paymentId: string;
  storyId: string;
  senderUserId: string;
  receiverUserId: string;
  paymentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  amount: number;
  message: string | null;
  createdAt: string;
}