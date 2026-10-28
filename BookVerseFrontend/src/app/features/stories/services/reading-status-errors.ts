import { HttpErrorResponse } from '@angular/common/http';

export function isPremiumStoryPlanError(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    error.error?.message ===
      'Free users can only create or update reading statuses for free stories'
  );
}
