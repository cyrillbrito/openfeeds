import { fetchWithTimeout, parseFeedContent, type ParseFeedResult } from '@repo/shared/rss';

export type { ParseFeedResult } from '@repo/shared/rss';

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
  const headers: Record<string, string> = {};
  if (opts.etag) {
    headers['If-None-Match'] = opts.etag;
  }
  if (opts.lastModified) {
    headers['If-Modified-Since'] = opts.lastModified;
  }

  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, { headers });
  if (!response) {
    throw new Error('Failed to fetch feed');
  }

  // 304 Not Modified — feed hasn't changed, skip all processing
  if (response.status === 304) {
    return { notModified: true };
  }

  if (!response.ok) {
    throw new HttpFetchError(response.status, response.statusText);
  }

  const xmlText = await response.text();
  const feed = parseFeedContent(xmlText);
  if (!feed) {
    throw new Error('Failed to parse feed');
  }

  return {
    notModified: false,
    feed,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    httpStatus: response.status,
  };
}
