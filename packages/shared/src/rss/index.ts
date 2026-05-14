import { parseFeed } from 'feedsmith';
import { FetchTimeoutError, safeFetch, SsrfBlockedError } from '../http/safe-fetch';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

export { FetchTimeoutError, SsrfBlockedError } from '../http/safe-fetch';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
]);

const FEED_DISCRIMINATOR_PARAMS = new Set([
  'alt',
  'format',
  'output',
  'view',
  'orderby',
  'order',
  'max-results',
  'start-index',
  'updated-min',
  'updated-max',
  'published-min',
  'published-max',
  'q',
  'label',
  'tag',
  'cat',
  'category',
]);

/**
 * Fetches `url` with a hard timeout and SSRF protection.
 *
 * Returns `null` on network errors (preserving the previous contract).
 * Throws {@link FetchTimeoutError} on timeout and {@link SsrfBlockedError}
 * if the URL targets a blocked host (loopback, link-local, RFC 1918, cloud
 * metadata, etc.). Callers that need to treat blocked hosts as a soft
 * failure should catch `SsrfBlockedError` explicitly.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response | null> {
  // Strip caller-supplied signal/redirect — safeFetch owns both.
  const { signal: _signal, redirect: _redirect, ...rest } = init;
  void _signal;
  void _redirect;

  try {
    return await safeFetch(url, { ...rest, timeoutMs });
  } catch (error) {
    if (error instanceof FetchTimeoutError || error instanceof SsrfBlockedError) {
      throw error;
    }
    return null;
  }
}

export function canonicalizeFeedUrl(url: string): string {
  try {
    const parsed = new URL(normalizeFeedUrl(url));
    parsed.protocol = 'https:';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';

    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function canonicalizeFeedEquivalenceUrl(url: string): string {
  try {
    const parsed = new URL(canonicalizeFeedUrl(url));

    const isBloggerDefaultFeed =
      (parsed.hostname.endsWith('.blogspot.com') || parsed.hostname.endsWith('.blogger.com')) &&
      /^\/feeds\/posts\/default\/?$/i.test(parsed.pathname);

    const keptParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();

      if (isBloggerDefaultFeed) {
        // Blogger often emits duplicate feed URLs that only differ in transport/view params.
        // Keep only params that change feed scope.
        if (lowerKey === 'q' || lowerKey === 'label' || lowerKey === 'tag') {
          keptParams.append(key, value);
        }
        continue;
      }

      if (FEED_DISCRIMINATOR_PARAMS.has(lowerKey)) {
        keptParams.append(key, value);
      }
    }

    const sorted = Array.from(keptParams.entries()).toSorted(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    for (const [key, value] of sorted) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch {
    return canonicalizeFeedUrl(url);
  }
}

export function normalizeFeedUrl(url: string): string {
  return url
    .replace(/^(feed:\/\/)/, 'https://')
    .replace(/^(feed:)/, '')
    .replace(/^(http:\/\/)/, 'https://');
}

export function parseFeedContent(content: string): ParseFeedResult | null {
  try {
    return parseFeed(content);
  } catch {
    return null;
  }
}

export function normalizeFeedTypeFromHeader(contentType: string): string | undefined {
  const lower = contentType.toLowerCase();
  if (lower.includes('application/rss+xml')) return 'application/rss+xml';
  if (lower.includes('application/atom+xml')) return 'application/atom+xml';
  if (lower.includes('application/feed+json')) return 'application/feed+json';
  if (lower.includes('application/json')) return 'application/json';
  return contentType || undefined;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function extractBasicSiteMetadata(document: Document): {
  icon?: string;
  description?: string;
} {
  const descriptionSelectors = [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ];

  let description: string | undefined;
  for (const selector of descriptionSelectors) {
    const value = document.querySelector(selector)?.getAttribute('content');
    if (value) {
      description = decodeHtml(value);
      break;
    }
  }

  const iconSelectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="shortcut icon"]',
    'link[rel="icon"]',
  ];

  for (const selector of iconSelectors) {
    const href = document.querySelector(selector)?.getAttribute('href');
    if (href) {
      return { icon: href, description };
    }
  }

  return { description };
}
