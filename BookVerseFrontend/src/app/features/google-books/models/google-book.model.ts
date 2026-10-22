export interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    language?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string };
  };
}
export interface GoogleBooksResponse {
  items?: GoogleBook[] | null;
}
export type SearchType = 'query' | 'title' | 'author';
