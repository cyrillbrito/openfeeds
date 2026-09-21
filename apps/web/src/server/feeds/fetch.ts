// Fetching a feed document over HTTP, with conditional GET: echoing back
// the ETag / Last-Modified from last time turns an unchanged feed into a
// 304 with no body and no parse.
import 'server-only';

/** How long to wait on a feed before giving up. Slow feeds are common. */
const TIMEOUT_MS = 15_000;

/**
 * Some hosts serve 403 without a plausible User-Agent. Exported so discovery
 * identifies itself the same way the sweep does.
 */
export const USER_AGENT =
  'OpenFeeds/2.0 (+https://github.com/cyrillbrito/openfeeds; feed reader)';

export type FetchFeedResult =
  /** The feed changed (or we had no validators): `body` is the document. */
  | { status: 'ok'; body: string; etag?: string; lastModified?: string }
  /** 304 — unchanged since last fetch. Nothing to parse, nothing to write. */
  | { status: 'not-modified' }
  /** Anything else: a dead host, a 404, a timeout, a 500. */
  | { status: 'error'; message: string };

export interface ConditionalHeaders {
  etag?: string | null;
  lastModified?: string | null;
}

/**
 * Never throws: every failure becomes an `error` result, so the sweep
 * records the reason on the row and carries on with the other feeds.
 */
export async function fetchFeed(
  url: string,
  conditional: ConditionalHeaders = {},
): Promise<FetchFeedResult> {
  const headers: Record<string, string> = {
    accept:
      'application/atom+xml, application/rss+xml, application/xml;q=0.9, application/feed+json;q=0.9, text/xml;q=0.8, */*;q=0.5',
    'user-agent': USER_AGENT,
    'accept-encoding': 'gzip, deflate',
  };
  if (conditional.etag) headers['if-none-match'] = conditional.etag;
  if (conditional.lastModified) {
    headers['if-modified-since'] = conditional.lastModified;
  }

  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 304) return { status: 'not-modified' };

    if (!response.ok) {
      return {
        status: 'error',
        message: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    const body = await response.text();
    if (body.trim().length === 0) {
      return { status: 'error', message: 'Empty response body' };
    }

    return {
      status: 'ok',
      body,
      // Stored verbatim, to echo back next time.
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? `Timed out after ${TIMEOUT_MS / 1000}s`
          : error.message
        : 'Unknown fetch error';
    return { status: 'error', message };
  }
}

/** Query parameters that identify a campaign, not a document. */
const TRACKING_PARAMS = /^(utm_|ref_?$|fbclid$|gclid$|mc_(cid|eid)$)/i;

/**
 * Reduce a feed URL to a canonical form so the same feed is one row.
 *
 * Deliberately conservative: a duplicate row is untidy, two different feeds
 * merged into one silently loses a subscription. Only removes things that
 * cannot change which document is served — no http→https upgrade, no path
 * rewriting beyond a trailing slash on the root.
 */
export function canonicalizeFeedUrl(input: string): string {
  const trimmed = input.trim();
  // A bare "example.com/feed" is what people actually paste.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const url = new URL(withScheme);

  // Case is insignificant in scheme and host, significant in the path.
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  // Default ports are redundant.
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  // Fragments are never sent to the server at all.
  url.hash = '';

  // The keys are materialised BEFORE deleting: mutating a live
  // URLSearchParams iterator while walking it skips entries.
  const params = Array.from(url.searchParams.keys());
  for (const key of params) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }

  // "https://host/" and "https://host" are the same request.
  if (url.pathname === '/') url.pathname = '';

  return url.href;
}
