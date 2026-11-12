import { StoryAccessType } from './story-access-type';

export interface StoryResponse {
  idExternal: string;
  authorId: string;
  authorUsername?: string | null;
  genre?: string | null;
  title: string;
  description: string;
  accessType: StoryAccessType;
  hidden: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  chaptersCount: number;
}
