import { Readability } from '@mozilla/readability';
import { attempt, attemptAsync } from '@repo/shared/utils';
import { JSDOM } from 'jsdom';

/**
 * Fetches an article URL and extracts clean content using Readability.
 * This module depends on jsdom and should only be used in server/worker contexts.
 */
export async function fetchAndProcessArticle(url: string): Promise<string | null> {
  const [fetchErr, response] = await attemptAsync(fetch(url));
  if (fetchErr || !response.ok) {
    return null;
  }

  const [textErr, html] = await attemptAsync(response.text());
  if (textErr) {
    return null;
  }

  const [domErr, dom] = attempt(() => new JSDOM(html, { url }));
  if (domErr) {
    return null;
  }

  const [readerErr, reader] = attempt(() => new Readability(dom.window.document));
  if (readerErr) {
    return null;
  }

  const [parseErr, article] = attempt(() => reader.parse());
  if (parseErr) {
    return null;
  }

  return article?.content || null;
}
