import { Readability } from '@mozilla/readability';
import type { ArticleContent } from './types.js';

export type { ArticleContent } from './types.js';

/**
 * Extract readable content from the current page document
 */
export function extractFromPage(doc: Document = document): ArticleContent {
  const reader = new Readability(doc as any);
  const article = reader.parse();

  if (!article) {
    return { title: null, excerpt: null, content: null };
  }

  return {
    title: article.title || null,
    excerpt: article.excerpt || null,
    content: article.content || null,
  };
}
