export interface User {
  idExternal: string;
  username: string;
  email: string;
  status: string;
}

export interface UpdateUserRequest {
  username: string;
  email: string;
}

export type AccountStoryAction = 'KEEP' | 'DELETE';

export interface AccountDeactivationRequest {
  storyAction: AccountStoryAction;
  creatorReplacements: Record<string, string>;
}
