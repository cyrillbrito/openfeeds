/**
 * Result of extracting readable content from a document
 */
export interface ArticleContent {
  title: string | null;
  excerpt: string | null;
  content: string | null;
  author: string | null;
  published: string | null;
  image: string | null;
  wordCount: number | null;
}
