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

export interface FetchRssOptions {
  /** ETag from the previous successful fetch — sent as If-None-Match */
  etag?: string | null;
  /** Last-Modified from the previous successful fetch — sent as If-Modified-Since */
  lastModified?: string | null;
}

export type FetchRssResult =
  | { notModified: true }
  | {
      notModified: false;
      feed: ParseFeedResult;
      /** ETag header from the response, if present */
      etag: string | null;
      /** Last-Modified header from the response, if present */
      lastModified: string | null;
      /** HTTP status code */
      httpStatus: number;
    };

export async function fetchRss(url: string, opts: FetchRssOptions = {}): Promise<FetchRssResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  if (opts.etag) {
    headers['If-None-Match'] = opts.etag;
  }
  if (opts.lastModified) {
    headers['If-Modified-Since'] = opts.lastModified;
  }

  try {
    const response = await fetch(url, { signal: controller.signal, headers });

    // 304 Not Modified — feed hasn't changed, skip all processing
    if (response.status === 304) {
      return { notModified: true };
    }

    if (!response.ok) {
      throw new HttpFetchError(response.status, response.statusText);
    }

    const xmlText = await response.text();
    const feed = parseFeed(xmlText);

    return {
      notModified: false,
      feed,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      httpStatus: response.status,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Feed fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
