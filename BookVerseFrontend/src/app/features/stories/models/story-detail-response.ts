import { ChapterSummary } from './chapter-summary';
import { StoryAccessType } from './story-access-type';

export interface StoryDetailResponse {
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
  chapters: ChapterSummary[];
}