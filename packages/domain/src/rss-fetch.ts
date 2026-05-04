import { fetchWithTimeout, parseFeedContent, type ParseFeedResult } from '@repo/shared/rss';

export type { ParseFeedResult } from '@repo/shared/rss';

/**
 * Base class for all expected failures when fetching/parsing a remote feed.
 * Boundary handlers (workers, server functions) can use `instanceof FeedFetchError`
 * to distinguish operational fetch errors from genuine bugs.
 */
export class FeedFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedFetchError';
  }
}

/** Remote server returned a non-2xx, non-304 response. */
export class HttpFetchError extends FeedFetchError {
  constructor(
    public readonly status: number,
    statusText: string,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'HttpFetchError';
  }
}

/** Network-level failure (DNS, timeout, connection reset, etc.). */
export class FeedNetworkError extends FeedFetchError {
  constructor(message = 'Failed to fetch feed') {
    super(message);
    this.name = 'FeedNetworkError';
  }
}

/** Response body could not be parsed as RSS/Atom or was an unsupported format. */
export class FeedParseError extends FeedFetchError {
  constructor(message = 'Failed to parse feed') {
    super(message);
    this.name = 'FeedParseError';
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
    throw new FeedNetworkError();
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
    throw new FeedParseError();
  }

  return {
    notModified: false,
    feed,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    httpStatus: response.status,
  };
}
