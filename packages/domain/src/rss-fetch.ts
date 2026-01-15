import { attempt, attemptAsync } from '@repo/shared/utils';
import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

export async function fetchRss(url: string): Promise<ParseFeedResult> {
  const [fetchErr, response] = await attemptAsync(fetch(url));
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
}
