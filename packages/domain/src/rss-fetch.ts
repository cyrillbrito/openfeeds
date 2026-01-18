import { attempt, attemptAsync } from '@repo/shared/utils';
import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

const FETCH_TIMEOUT_MS = 30_000;

export async function fetchRss(url: string): Promise<ParseFeedResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const [fetchErr, response] = await attemptAsync(fetch(url, { signal: controller.signal }));
    if (fetchErr) {
      throw new Error(`Failed to fetch RSS: ${String(fetchErr)}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const [textErr, xmlText] = await attemptAsync(response.text());
    if (textErr) {
      throw new Error(`Failed to read RSS response: ${String(textErr)}`);
    }

    const [parseErr, parsedFeed] = attempt(() => parseFeed(xmlText));
    if (parseErr) {
      throw new Error(`Failed to parse RSS feed: ${String(parseErr)}`);
    }

    return parsedFeed;
  } finally {
    clearTimeout(timeoutId);
  }
}
