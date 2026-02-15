import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

const FETCH_TIMEOUT_MS = 30_000;

export async function fetchRss(url: string): Promise<ParseFeedResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    return parseFeed(xmlText);
  } finally {
    clearTimeout(timeoutId);
  }
}
