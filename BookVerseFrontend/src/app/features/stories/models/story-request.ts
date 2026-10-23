import { StoryAccessType } from './story-access-type';

export interface StoryRequest {
  authorId: string;
  title: string;
  description: string;
  accessType: StoryAccessType;
}