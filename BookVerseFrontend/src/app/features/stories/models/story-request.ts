import { StoryAccessType } from './story-access-type';

export interface StoryRequest {
  title: string;
  genre?: string;
  description: string;
  accessType: StoryAccessType;
}
