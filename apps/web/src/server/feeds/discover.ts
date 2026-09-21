// Turning "whatever the user pasted" into a feed URL, because people paste
// homepages.
//
// Two rules hold the design together:
//
//  1. "Is this already a feed?" is asked FIRST. It is the common case (one
//     request, then stop) and it makes rewriting a working feed URL into a
//     broken guess structurally impossible.
//  2. Every candidate returned has been fetched and parsed. A stale <link>
//     in someone's <head> must fail here, not an hour later as a dead
//     subscription.
import 'server-only';

import {
  detectAtomFeed,
  detectJsonFeed,
  detectRdfFeed,
  detectRssFeed,
} from 'feedsmith';

import { canonicalizeFeedUrl, USER_AGENT } from './fetch';
import { normalizeFeed } from './normalize';

/** Fetching the pasted page. Generous: it is one request and a human waits. */
const TIMEOUT_MS = 10_000;
/** Verifying a candidate, and probing a guess. Tighter: these run in bunches. */
const PROBE_TIMEOUT_MS = 6_000;
/** Verify a few at a time — same politeness cap as the sync sweep. */
const PROBE_CONCURRENCY = 4;
/** A <head> advertising more feeds than this is noise; take the first few. */
const MAX_LINK_CANDIDATES = 10;

/**
 * Last-resort guesses, tried only when the site advertises nothing. Kept
 * short: anything longer serves platforms that emit a <link> tag anyway,
 * and each entry is a request a user waits on.
 */
const GUESSED_PATHS = [
  '/feed',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/index.xml',
  '/feed.json',
] as const;

/**
 * `type` values that mean "this link is a feed". `text/xml` and
 * `application/xml` are absent on purpose: with `rel="alternate"` they mark
 * sitemaps and localised variants far more often than feeds.
 */
const FEED_LINK_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/feed+json',
  'application/json',
]);

export interface FeedCandidate {
  /** Canonical, final-after-redirects, and confirmed to parse. */
  url: string;
  title: string;
}

export type Discovery =
  /**
   * Exactly one feed. `body` is the document we already fetched to verify it,
   * so subscribing costs no further request.
   */
  | {
      status: 'feed';
      url: string;
      body: string;
      etag?: string;
      lastModified?: string;
    }
  /** Two or more. The dialog shows a picker. */
  | { status: 'candidates'; candidates: FeedCandidate[] }
  | { status: 'error'; message: string };

/** `discoverFeeds` returns an error branch rather than throwing. */
function safeCanonical(url: string): string | undefined {
  try {
    return canonicalizeFeedUrl(url);
  } catch {
    return undefined;
  }
}

/** Does this document parse as any feed format we support? */
export function isFeedBody(body: string): boolean {
  return (
    detectRssFeed(body) ||
    detectAtomFeed(body) ||
    detectRdfFeed(body) ||
    detectJsonFeed(body)
  );
}

interface FetchedDocument {
  /** The FINAL url after redirects — the base for resolving relative links. */
  url: string;
  body: string;
  etag?: string;
  lastModified?: string;
}

type DocumentResult =
  | { ok: true; doc: FetchedDocument }
  | { ok: false; message: string };

/**
 * Fetch something that might be a feed or might be a web page. Distinct from
 * `fetchFeed`, which asks only for feed types and sends validators.
 */
async function fetchDocument(
  url: string,
  timeoutMs = TIMEOUT_MS,
): Promise<DocumentResult> {
  try {
    const response = await fetch(url, {
      headers: {
        accept:
          'text/html, application/xhtml+xml, application/atom+xml, application/rss+xml, application/rdf+xml, application/feed+json, application/xml;q=0.9, */*;q=0.5',
        'user-agent': USER_AGENT,
        'accept-encoding': 'gzip, deflate',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    const body = await response.text();
    if (body.trim().length === 0) {
      return { ok: false, message: 'Empty response body' };
    }

    return {
      ok: true,
      doc: {
        // `response.url` is empty on some synthetic responses; the requested
        // URL is the right fallback and is already canonical.
        url: response.url || url,
        body,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? `Timed out after ${timeoutMs / 1000}s`
          : error.message
        : 'Unknown fetch error';
    return { ok: false, message };
  }
}

interface HeadLink {
  rel: string;
  type: string;
  href: string;
  title: string;
}

/**
 * Read `<base>` and `<link>` out of an HTML document. `HTMLRewriter` is a
 * Bun builtin, so this costs no HTML-parsing dependency.
 */
async function readHeadLinks(
  html: string,
): Promise<{ base?: string; links: HeadLink[] }> {
  let base: string | undefined;
  const links: HeadLink[] = [];

  await new HTMLRewriter()
    .on('base', {
      element(element) {
        // Only the first <base href> in a document has any effect.
        if (base !== undefined) return;
        const href = element.getAttribute('href');
        if (href) base = href;
      },
    })
    .on('link', {
      element(element) {
        const href = element.getAttribute('href');
        if (!href) return;
        links.push({
          rel: (element.getAttribute('rel') ?? '').toLowerCase(),
          // Strip any `; charset=…` parameter before comparing.
          type: (element.getAttribute('type') ?? '')
            .toLowerCase()
            .split(';')[0]
            .trim(),
          href,
          title: element.getAttribute('title') ?? '',
        });
      },
    })
    .transform(new Response(html))
    .text();

  return { base, links };
}

/** The advertised feeds in a page's markup, as absolute URLs. */
export async function feedLinksIn(
  html: string,
  documentUrl: string,
): Promise<{ url: string; title: string }[]> {
  const { base, links } = await readHeadLinks(html);
  // A <base href> is itself allowed to be relative to the document.
  let resolveAgainst = documentUrl;
  if (base) {
    try {
      resolveAgainst = new URL(base, documentUrl).href;
    } catch {
      /* A malformed <base> is ignored, exactly as a browser ignores it. */
    }
  }

  const found: { url: string; title: string }[] = [];
  for (const link of links) {
    const rel = new Set(link.rel.split(/\s+/));
    if (!rel.has('alternate') && !rel.has('feed')) continue;
    if (!FEED_LINK_TYPES.has(link.type)) continue;

    // WordPress advertises its REST API as `type="application/json"` on an
    // alternate link. It is not a feed, and it is on a large share of the web.
    if (link.type === 'application/json' && /\/wp-json(\/|$)/.test(link.href)) {
      continue;
    }

    try {
      found.push({
        url: new URL(link.href, resolveAgainst).href,
        title: link.title,
      });
    } catch {
      /* An unresolvable href is simply not a candidate. */
    }
  }
  return found;
}

/**
 * Feeds derivable from a URL without asking the site. Every branch pins the
 * exact number of path segments it accepts — a loose pattern here turns
 * `github.com/owner/repo/issues` into a confidently wrong feed URL.
 *
 * Runs after the is-it-already-a-feed check, and its guesses still have to
 * survive verification.
 */
export function knownServiceFeeds(url: string): { url: string; title: string }[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }

  const host = parsed.hostname.replace(/^(www|old|m)\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com') {
    // A channel page also advertises its feed in <link>, so this matters
    // mainly when YouTube serves us a consent wall instead of the page.
    if (segments.length === 2 && segments[0] === 'channel') {
      return [
        {
          url: `https://www.youtube.com/feeds/videos.xml?channel_id=${segments[1]}`,
          title: 'YouTube channel',
        },
      ];
    }
    if (segments.length === 2 && segments[0] === 'user') {
      return [
        {
          url: `https://www.youtube.com/feeds/videos.xml?user=${segments[1]}`,
          title: 'YouTube channel',
        },
      ];
    }
    const list = parsed.searchParams.get('list');
    if (segments.length === 1 && segments[0] === 'playlist' && list) {
      return [
        {
          url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${list}`,
          title: 'YouTube playlist',
        },
      ];
    }
    // `/@handle` carries no channel id, so there is nothing to derive — the
    // <link> tag on the page is the only route, and it works.
    return [];
  }

  if (host === 'reddit.com') {
    if (
      segments.length === 2 &&
      (segments[0] === 'r' || segments[0] === 'user')
    ) {
      return [
        {
          url: `https://www.reddit.com/${segments[0]}/${segments[1]}/.rss`,
          title: `r/${segments[1]}`,
        },
      ];
    }
    return [];
  }

  if (host === 'github.com') {
    // Exactly owner/repo. A repo page's own <link> advertises only commits,
    // which for most repos is a firehose — offering all three lets the picker
    // do its job.
    if (segments.length === 2) {
      const repo = `https://github.com/${segments[0]}/${segments[1]}`;
      return [
        { url: `${repo}/releases.atom`, title: 'Releases' },
        { url: `${repo}/commits.atom`, title: 'Commits' },
        { url: `${repo}/tags.atom`, title: 'Tags' },
      ];
    }
    if (segments.length === 1) {
      return [
        {
          url: `https://github.com/${segments[0]}.atom`,
          title: `${segments[0]} activity`,
        },
      ];
    }
    return [];
  }

  return [];
}

interface VerifiedFeed {
  candidate: FeedCandidate;
  body: string;
  etag?: string;
  lastModified?: string;
  /** Identifies the CONTENT, so the same feed in two formats collapses. */
  fingerprint: string;
}

/**
 * What makes two feed documents "the same feed" — most static-site
 * generators publish identical content at both /atom.xml and /rss.xml, and a
 * picker with two indistinguishable rows is worse than not asking.
 *
 * The newest item is part of the key because a blog and its comments feed
 * share a title and site link.
 */
function fingerprintOf(parsed: ReturnType<typeof normalizeFeed>): string {
  return [
    parsed.title,
    parsed.siteUrl ?? '',
    parsed.items[0]?.guid ?? '',
    parsed.items.length,
  ].join(' ');
}

/**
 * Confirm a candidate by fetching and parsing it. `hint` is the label the
 * source gave (a `<link title>`, or "Releases"); the feed's own title wins.
 */
async function verifyCandidate(
  url: string,
  hint: string,
): Promise<VerifiedFeed | null> {
  const result = await fetchDocument(url, PROBE_TIMEOUT_MS);
  if (!result.ok) return null;
  if (!isFeedBody(result.doc.body)) return null;

  try {
    const parsed = normalizeFeed(result.doc.body, result.doc.url);
    return {
      candidate: {
        url: canonicalizeFeedUrl(result.doc.url),
        title: parsed.title || hint || result.doc.url,
      },
      body: result.doc.body,
      etag: result.doc.etag,
      lastModified: result.doc.lastModified,
      fingerprint: fingerprintOf(parsed),
    };
  } catch {
    // Detected as a feed but not parseable here, so subscribing would fail.
    return null;
  }
}

/** Verify a batch, a few at a time, dropping duplicates and failures. */
async function verifyAll(
  candidates: { url: string; title: string }[],
): Promise<VerifiedFeed[]> {
  // Dedupe BEFORE fetching: a page listing the same feed in <head> and in a
  // <link rel="feed"> would otherwise be fetched twice.
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    let key: string;
    try {
      key = canonicalizeFeedUrl(candidate.url);
    } catch {
      return false;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const verified: VerifiedFeed[] = [];
  for (let i = 0; i < unique.length; i += PROBE_CONCURRENCY) {
    const batch = unique.slice(i, i + PROBE_CONCURRENCY);
    const results = await Promise.all(
      batch.map((candidate) => verifyCandidate(candidate.url, candidate.title)),
    );
    verified.push(...results.filter((r): r is VerifiedFeed => r !== null));
  }

  // Dedupe again once the answers are in: by final URL (two candidates can
  // redirect to one document) and by content. First wins — a page's first
  // advertised feed is its primary one by convention.
  const seenUrls = new Set<string>();
  const seenContent = new Set<string>();
  const unified: VerifiedFeed[] = [];
  for (const feed of verified) {
    if (seenUrls.has(feed.candidate.url)) continue;
    if (seenContent.has(feed.fingerprint)) continue;
    seenUrls.add(feed.candidate.url);
    seenContent.add(feed.fingerprint);
    unified.push(feed);
  }
  return unified;
}

/**
 * Guessed paths, tried against the pasted directory before the origin — a
 * blog at `example.com/blog` usually keeps its feed under `/blog`. Stops at
 * the first base that yields anything.
 */
async function probeGuessedPaths(documentUrl: string): Promise<VerifiedFeed[]> {
  let parsed: URL;
  try {
    parsed = new URL(documentUrl);
  } catch {
    return [];
  }

  const bases: string[] = [];
  const path = parsed.pathname.replace(/\/$/, '');
  if (path) {
    const last = path.slice(path.lastIndexOf('/') + 1);
    // `/blog` is a section and probably holds the feed; `/posts/hello.html` is
    // a document, so its folder is the thing to ask about.
    const directory = last.includes('.')
      ? path.slice(0, path.lastIndexOf('/'))
      : path;
    if (directory) bases.push(parsed.origin + directory);
  }
  bases.push(parsed.origin);

  for (const base of bases) {
    const found = await verifyAll(
      GUESSED_PATHS.map((path) => ({ url: base + path, title: '' })),
    );
    if (found.length > 0) return found;
  }
  return [];
}

/** One verified feed collapses to `feed`; several become a picker. */
function collapse(verified: VerifiedFeed[]): Discovery {
  const only = verified[0];
  if (verified.length === 1 && only) {
    return {
      status: 'feed',
      url: only.candidate.url,
      body: only.body,
      etag: only.etag,
      lastModified: only.lastModified,
    };
  }
  return {
    status: 'candidates',
    candidates: verified.map((feed) => feed.candidate),
  };
}

/**
 * Resolve a pasted URL to the feed (or feeds) behind it. Ordered
 * cheapest-and-most-certain first; each stage returns as soon as it finds
 * anything, so pasting a real feed URL costs exactly one request.
 */
export async function discoverFeeds(rawUrl: string): Promise<Discovery> {
  let startUrl: string;
  try {
    startUrl = canonicalizeFeedUrl(rawUrl);
  } catch {
    return { status: 'error', message: `"${rawUrl}" is not a valid URL` };
  }

  // 1. Is it already a feed? Must come first — see the module comment.
  const fetched = await fetchDocument(startUrl);
  if (fetched.ok && isFeedBody(fetched.doc.body)) {
    return {
      status: 'feed',
      // A redirect can land somewhere unparseable; the requested URL is
      // already canonical, so it is the right fallback.
      url: safeCanonical(fetched.doc.url) ?? startUrl,
      body: fetched.doc.body,
      etag: fetched.doc.etag,
      lastModified: fetched.doc.lastModified,
    };
  }

  // 2. Feeds derivable from the URL itself — works even when the page was
  //    unreachable, which is the point for YouTube's consent wall.
  const service = knownServiceFeeds(startUrl);
  if (service.length > 0) {
    const verified = await verifyAll(service);
    if (verified.length > 0) return collapse(verified);
  }

  // 3. What the page advertises, from the HTML already in hand.
  if (fetched.ok) {
    const links = await feedLinksIn(fetched.doc.body, fetched.doc.url);
    if (links.length > 0) {
      const verified = await verifyAll(links.slice(0, MAX_LINK_CANDIDATES));
      if (verified.length > 0) return collapse(verified);
    }
  }

  // 4. Guesses — last, the only stage that fetches URLs nobody mentioned.
  const guessed = await probeGuessedPaths(
    fetched.ok ? fetched.doc.url : startUrl,
  );
  if (guessed.length > 0) return collapse(guessed);

  return {
    status: 'error',
    message: fetched.ok
      ? 'No feed found at that address'
      : `Could not reach that address — ${fetched.message}`,
  };
}
