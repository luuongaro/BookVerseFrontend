export interface UserProfile {
  idExternal: string;
  username: string;
}

export interface UserProfileStory {
  idExternal: string;
  title: string;
  description: string;
  accessType: 'FREE' | 'PREMIUM';
}
