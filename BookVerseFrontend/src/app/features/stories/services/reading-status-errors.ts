import { HttpErrorResponse } from '@angular/common/http';

export function isPremiumStoryPlanError(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    error.error?.message ===
      'Free users can only create or update reading statuses for free stories'
  );
}

export function isFreeStoryLimitError(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 400 &&
    error.error?.message ===
      'You have reached the maximum number of active stories allowed by your current subscription'
  );
}

export function isPremiumStoryAccessError(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    error.error?.message ===
      'You need a premium subscription to access this story'
  );
}
