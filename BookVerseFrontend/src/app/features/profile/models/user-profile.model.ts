export interface UserProfile {
  idExternal: string;
  username: string;
  avatarIndex?: number;
}

export interface UserProfileStory {
  idExternal: string;
  title: string;
  description: string;
  accessType: 'FREE' | 'PREMIUM';
}

export interface ProfileActivity {
  wantToRead: number;
  inProgress: number;
  finished: number;
  createdStories: number;
  activeGroups: number;
  tipStoryId?: string | null;
}

export interface ProfileAppearance {
  coverIndex: number;
  avatarIndex: number;
  configured: boolean;
}
