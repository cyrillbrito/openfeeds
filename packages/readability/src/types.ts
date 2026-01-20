/**
 * Result of extracting readable content from a document
 */
export interface ArticleContent {
  title: string | null;
  excerpt: string | null;
  content: string | null;
}
