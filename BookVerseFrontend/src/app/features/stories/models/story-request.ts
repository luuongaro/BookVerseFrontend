import { StoryAccessType } from './story-access-type';

export interface StoryRequest {
  title: string;
  description: string;
  accessType: StoryAccessType;
}
