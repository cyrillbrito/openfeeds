import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

const FETCH_TIMEOUT_MS = 30_000;

export async function fetchRss(url: string): Promise<ParseFeedResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      throw new Error(`Failed to fetch RSS: ${String(error)}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let xmlText: string;
    try {
      xmlText = await response.text();
    } catch (error) {
      throw new Error(`Failed to read RSS response: ${String(error)}`);
    }

    try {
      return parseFeed(xmlText);
    } catch (error) {
      throw new Error(`Failed to parse RSS feed: ${String(error)}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
