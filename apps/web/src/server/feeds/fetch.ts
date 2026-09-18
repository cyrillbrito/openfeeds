// Fetching a feed document over HTTP, politely.
//
// The headline feature is CONDITIONAL GET. v1's fetcher was a bare
// `fetch(url)`, so every sweep downloaded every feed in full — for feeds that
// had not changed, which is most of them, most of the time. Sending back the
// ETag / Last-Modified the server gave us last time turns that into a 304
// with an empty body: a few hundred bytes and no parse. It is roughly ten
// lines of code and it is the single biggest efficiency win available here.
import 'server-only';

/** How long to wait on a feed before giving up. Slow feeds are common. */
const TIMEOUT_MS = 15_000;

/**
 * Some hosts serve 403 to clients without a plausible User-Agent.
 *
 * Exported so discovery identifies itself the same way the sync sweep does —
 * a host that decides to block us should see one client, not two.
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
 * Fetch a feed document, sending validators when we have them.
 *
 * Never throws: every failure mode becomes an `error` result, because the
 * caller's job is to record the reason on the feed row and keep sweeping the
 * other feeds rather than abort the run.
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

    // The whole point: the server says "you already have this".
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
      // Store whatever the server gave us, verbatim, to echo back next time.
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
 * Deliberately CONSERVATIVE. Two duplicate feed rows are a cosmetic
 * annoyance; two genuinely different feeds merged into one row silently
 * loses a subscription. So this only removes things that cannot change which
 * document is served — it does NOT upgrade http to https (they can be
 * different servers) and does NOT touch the path beyond a trailing slash on
 * the root.
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
