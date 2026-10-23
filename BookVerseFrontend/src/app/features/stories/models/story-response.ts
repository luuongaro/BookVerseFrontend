import { StoryAccessType } from './story-access-type';

export interface StoryResponse {
  idExternal: string;
  authorId: string;
  title: string;
  description: string;
  accessType: StoryAccessType;
  hidden: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  chaptersCount: number;
}