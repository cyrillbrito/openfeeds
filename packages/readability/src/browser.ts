import Defuddle from 'defuddle';
import type { ArticleContent } from './types.js';

export type { ArticleContent } from './types.js';

/**
 * Extract readable content from the current page document using Defuddle
 */
export function extractFromPage(doc: Document = document): ArticleContent {
  const result = new Defuddle(doc).parse();

  return {
    title: result.title ?? null,
    excerpt: result.description ?? null,
    content: result.content ?? null,
    author: result.author ?? null,
    published: result.published ?? null,
    image: result.image ?? null,
    wordCount: result.wordCount ?? null,
  };
}
