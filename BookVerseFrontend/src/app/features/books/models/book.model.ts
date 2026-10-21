export interface Book {
  idExternal: string;
  googleBookId: string;
  title: string;
  description: string | null;
  isbn: string | null;
  thumbnailUrl: string | null;
  publisher: string | null;
  publishedDate: string | null;
  language: string | null;
  categories: string | null;
  authors: string[];
  readingGroupsCount: number;
  readingStatusesCount: number;
}
export interface BookPage {
  content: Book[];
  number: number;
  totalPages: number;
  totalElements: number;
  first: boolean;
  last: boolean;
}
