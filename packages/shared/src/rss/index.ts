import { parseFeed } from 'feedsmith';

export type ParseFeedResult = ReturnType<typeof parseFeed>;

export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Feed fetch timed out after ${timeoutMs / 1000}s`);
  }
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
]);

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new FetchTimeoutError(timeoutMs);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
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
