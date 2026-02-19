import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

export class HttpFetchError extends Error {
  constructor(
    public readonly status: number,
    statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
  }
}

const FETCH_TIMEOUT_MS = 30_000;

export async function fetchRss(url: string): Promise<ParseFeedResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new HttpFetchError(response.status, response.statusText);
    }

    const xmlText = await response.text();
    return parseFeed(xmlText);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Feed fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
