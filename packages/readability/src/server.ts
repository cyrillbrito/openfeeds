import { Defuddle } from 'defuddle/node';
import { JSDOM } from 'jsdom';
import type { ArticleContent } from './types.js';

export type { ArticleContent } from './types.js';

const FETCH_TIMEOUT_MS = 30_000;

const EMPTY_RESULT: ArticleContent = {
  title: null,
  excerpt: null,
  content: null,
  author: null,
  published: null,
  image: null,
  wordCount: null,
};

function mapResult(result: Awaited<ReturnType<typeof Defuddle>>): ArticleContent {
  return {
    title: result.title || null,
    excerpt: result.description || null,
    content: result.content || null,
    author: result.author || null,
    published: result.published || null,
    image: result.image || null,
    wordCount: result.wordCount ?? null,
  };
}

/**
 * Fetch a URL and extract readable content using JSDOM + Defuddle
 */
export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OpenFeeds/1.0; +https://openfeeds.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`[${url}] Fetch failed with status ${response.status}`);
      return EMPTY_RESULT;
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const result = await Defuddle(dom.window.document, url);

    if (!result.content) {
      console.error(`[${url}] Defuddle returned no content`);
      return EMPTY_RESULT;
    }

    console.log(`[${url}] Extracted: "${result.title}" (${result.content.length} chars)`);
    return mapResult(result);
  } catch (error) {
    console.error(
      `[${url}] Article extraction failed:`,
      error instanceof Error ? error.message : String(error),
    );
    return EMPTY_RESULT;
  }
}

/**
 * Batch fetch multiple URLs and extract readable content
 */
export async function fetchArticleContentBatch(
  urls: string[],
): Promise<Map<string, ArticleContent>> {
  const results = new Map<string, ArticleContent>();

  for (const url of urls) {
    const content = await fetchArticleContent(url);
    results.set(url, content);
  }

  return results;
}
