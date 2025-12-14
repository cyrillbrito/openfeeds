import { checkKnownServices } from './services.js';
import type { DiscoveryOptions, Feed } from './types.js';
import { isSupportedProtocol, resolveUrl } from './utils.js';

/**
 * RSS MIME types to look for in HTML link tags
 */
const RSS_MIME_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss',
  'application/atom',
  'application/rdf',
  'text/rss+xml',
  'text/atom+xml',
  'text/rdf+xml',
  'text/rss',
  'text/atom',
  'text/rdf',
  // JSON Feed support
  'application/json',
  'application/feed+json',
  'text/json',
];

/**
 * Common RSS feed paths to try as fallback
 */
const COMMON_FEED_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
  '/index.xml',
  '/index.rss',
  '/index.atom',
  '/index.json',
  '/feed.json',
  '/rss/news.xml',
  '/articles/feed',
  '/rss/index.html',
  '/blog/feed/',
  '/blog/rss/',
  '/blog/rss.xml',
  '/feed/posts/default',
  '/feeds/default',
  '/feed/default',
  '/data/rss',
  '/?feed=rss',
  '/?feed=atom',
  '/?feed=rss2',
  '/?feed=rdf',
  '/?format=feed',
  '/rss/featured',
];

/**
 * URL patterns that indicate invalid feed URLs
 */
const INVALID_URL_PATTERNS = [
  'wp-includes',
  'wp-json',
  'xmlrpc',
  'wp-admin',
  '/amp/',
  'mailto:',
  '//fonts.',
  '//font.',
];

/**
 * File extensions to skip (obvious non-feeds)
 */
const INVALID_EXTENSIONS = /\.(jpe?g|png|gif|bmp|mp4|mp3|mkv|css|js|pdf|woff2?|svg|ttf|zip)$/i;

/**
 * Default options for feed discovery
 */
const DEFAULT_OPTIONS: DiscoveryOptions = {
  timeout: 10000,
  followRedirects: true,
  userAgent: 'RSS-Discovery-Bot/1.0',
};

/**
 * Normalize URL handling feed: protocol and other variations
 */
function normalizeUrl(url: string, baseUrl?: string): string {
  // Handle feed: protocol by converting to https:
  let normalizedUrl = url
    .replace(/^(feed:\/\/)/, 'https://')
    .replace(/^(feed:)/, '')
    .replace(/^(http:\/\/)/, 'https://');

  // Resolve relative URLs if baseUrl provided
  if (baseUrl && !normalizedUrl.startsWith('http')) {
    normalizedUrl = resolveUrl(baseUrl, normalizedUrl);
  }

  return normalizedUrl;
}

/**
 * Extract feed title from RSS/Atom content
 */
function extractFeedTitle(content: string): string | null {
  // Clean up encoded content
  const cleanContent = content.replaceAll('&lt;', '<').replaceAll('&gt;', '>');

  // Updated regex to handle CDATA sections and other content within title tags
  const titleMatch = cleanContent.match(/<title>(.*?)<\/title>/is);
  if (titleMatch && titleMatch[1]) {
    let title = titleMatch[1];
    // Handle CDATA sections
    title = title.replace(/<!\[CDATA\[(.*?)]]>/gs, '$1');
    // Decode HTML entities (basic)
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Remove extra whitespace
    title = title.replace(/\s+/g, ' ');
    return title.trim();
  }
  return null;
}

/**
 * Validate if content is a valid feed (RSS, Atom, or JSON)
 */
function isValidFeedContent(content: string, contentType: string = ''): boolean {
  // Quick XML feed validation - be more flexible with RSS detection
  if (content.includes('<rss') || content.includes('<feed') || content.includes('<rdf:RDF')) {
    return true;
  }

  // JSON feed validation
  if (contentType.includes('json') || content.trim().startsWith('{')) {
    try {
      const json = JSON.parse(content);
      // JSON Feed format validation
      return json.version && json.items && Array.isArray(json.items);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Check if current URL content is already an RSS feed
 */
async function checkSelfRssFeed(url: string, options: DiscoveryOptions): Promise<Feed | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent || DEFAULT_OPTIONS.userAgent!,
          Accept:
            'application/rss+xml,application/atom+xml,application/xml,text/xml,application/json',
        },
        signal: controller.signal,
        redirect: options.followRedirects ? 'follow' : 'manual',
      });

      if (response.ok) {
        const content = await response.text();
        const contentType = response.headers.get('content-type') || '';

        if (isValidFeedContent(content, contentType)) {
          const title = extractFeedTitle(content) || url;
          return {
            url: url,
            title: title,
            type: contentType || undefined,
          };
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Not a feed, continue with other methods
  }

  return null;
}

/**
 * Check if URL should be skipped (performance optimization)
 */
function shouldSkipUrl(url: string): boolean {
  // Skip URLs with invalid patterns
  if (INVALID_URL_PATTERNS.some((pattern) => url.includes(pattern))) {
    return true;
  }

  // Skip URLs with invalid file extensions
  if (INVALID_EXTENSIONS.test(url)) {
    return true;
  }

  return false;
}

/**
 * Fetch HTML content from URL
 */
async function fetchHtmlContent(url: string, options: DiscoveryOptions): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': options.userAgent || DEFAULT_OPTIONS.userAgent!,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: options.followRedirects ? 'follow' : 'manual',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract RSS/Atom link tags from HTML content
 */
function extractFeedLinks(html: string, baseUrl: string): Feed[] {
  const feeds: Feed[] = [];

  // Regex to match link tags with RSS/Atom types, excluding stylesheets, icons, etc.
  const linkRegex =
    /<link\s+(?![^>]*\b(?:rel=['"](?:stylesheet|icon|search)['"]|type=['"](?:text\/javascript|image\/.*|font\/.*)['"']))[^>]*\btype=['"][^'"]+['"][^>]*>/gi;
  const matches = html.match(linkRegex) || [];

  for (const linkTag of matches) {
    // Extract type attribute
    const typeMatch = linkTag.match(/type=['"]([^'"]+)['"]/i);
    const type = typeMatch?.[1];

    if (type && RSS_MIME_TYPES.includes(type.toLowerCase())) {
      // Extract href attribute
      const hrefMatch = linkTag.match(/href=['"]([^'"]+)['"]/i);
      const href = hrefMatch?.[1];

      if (href) {
        // Normalize and resolve URLs (handles feed: protocol)
        const resolvedUrl = normalizeUrl(href, baseUrl);

        // Skip URLs that are obviously not feeds
        if (shouldSkipUrl(resolvedUrl)) {
          continue;
        }

        // Extract title attribute
        const titleMatch = linkTag.match(/title=['"]([^'"]+)['"]/i);
        const title = titleMatch?.[1] || href;

        feeds.push({
          url: resolvedUrl,
          title: title,
          type: type,
        });
      }
    }
  }

  return feeds;
}

/**
 * Extract feed links using heuristic analysis of anchor tags
 */
function extractHeuristicFeedLinks(html: string, baseUrl: string): Feed[] {
  const feeds: Feed[] = [];
  const unique = new Set<string>();

  // 1. Links with feed: protocol - need to capture the full tag including closing
  const feedProtocolRegex = /<a[^>]*href=['"]feed:[^'"]*['"][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = feedProtocolRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const linkText = match[1];
    const hrefMatch = fullTag.match(/href=['"]([^'"]+)['"]/i);

    if (hrefMatch && hrefMatch[1]) {
      const href = hrefMatch[1];
      const resolvedUrl = normalizeUrl(href, baseUrl);

      if (!shouldSkipUrl(resolvedUrl) && !unique.has(resolvedUrl)) {
        unique.add(resolvedUrl);

        // Extract title from title attribute or link text
        const titleMatch = fullTag.match(/title=['"]([^'"]+)['"]/i);
        const title = titleMatch?.[1] || (linkText && linkText.trim()) || 'RSS Feed';

        feeds.push({
          url: resolvedUrl,
          title: title.trim(),
          type: 'application/rss+xml',
        });
      }
    }
  }

  // 2. Heuristic patterns for RSS-like links
  const rssPattern = /([^a-zA-Z]|^)rss([^a-zA-Z]|$)/i;
  const linkRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>([^<]*)<\/a>/gi;
  let linkMatch;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    const linkText = linkMatch[2];
    const fullMatch = linkMatch[0];

    if (!href) continue;

    // Check for RSS-like patterns in href, title, class, or link text
    const hrefMatches = href.match(/\/(feed|rss|atom)(\.(xml|rss|atom))?\/?(\?.*)?$/);
    const titleMatch = fullMatch.match(/title=['"]([^'"]*)['"]/);
    const classMatch = fullMatch.match(/class=['"]([^'"]*)['"]/);

    const title = titleMatch?.[1] || '';
    const className = classMatch?.[1] || '';

    if (
      hrefMatches ||
      rssPattern.test(title) ||
      rssPattern.test(className) ||
      (linkText && rssPattern.test(linkText))
    ) {
      const resolvedUrl = normalizeUrl(href, baseUrl);

      if (!shouldSkipUrl(resolvedUrl) && !unique.has(resolvedUrl)) {
        unique.add(resolvedUrl);

        feeds.push({
          url: resolvedUrl,
          title: (linkText && linkText.trim()) || title || 'RSS Feed',
          type: 'application/rss+xml',
        });
      }
    }
  }

  return feeds;
}

/**
 * Try common RSS feed paths as fallback
 */
async function tryCommonPaths(baseUrl: string, options: DiscoveryOptions): Promise<Feed | null> {
  const urlObj = new URL(baseUrl);

  for (const path of COMMON_FEED_PATHS) {
    try {
      const feedUrl = urlObj.origin + path;
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        Math.min(options.timeout || 5000, 5000),
      );

      try {
        const response = await fetch(feedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent || DEFAULT_OPTIONS.userAgent!,
            Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml',
          },
          signal: controller.signal,
          redirect: options.followRedirects ? 'follow' : 'manual',
        });

        if (response.ok && response.status >= 200 && response.status < 400) {
          const content = await response.text();
          const contentType = response.headers.get('content-type') || '';

          // Validate feed content
          if (isValidFeedContent(content, contentType)) {
            return {
              url: feedUrl,
              title: feedUrl,
              type: contentType || undefined,
            };
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // Continue trying other paths
      continue;
    }
  }

  return null;
}

/**
 * Main RSS feed discovery function
 */
export async function discoverFeeds(url: string, options: DiscoveryOptions = {}): Promise<Feed[]> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Validate URL protocol
  if (!isSupportedProtocol(url)) {
    throw new Error(`Unsupported protocol: ${url}`);
  }

  // First, check if URL matches any known services
  const knownServiceResult = checkKnownServices(url);
  if (knownServiceResult && knownServiceResult.feeds.length > 0) {
    return knownServiceResult.feeds;
  }

  // Second, check if the URL itself is already an RSS feed
  const selfFeed = await checkSelfRssFeed(url, mergedOptions);
  if (selfFeed) {
    return [selfFeed];
  }

  // Fetch HTML content and parse for RSS links
  try {
    const html = await fetchHtmlContent(url, mergedOptions);

    // Extract feeds from HTML link tags
    const linkFeeds = extractFeedLinks(html, url);

    // Extract feeds using heuristic analysis
    const heuristicFeeds = extractHeuristicFeedLinks(html, url);

    // Combine all discovered feeds, removing duplicates
    const allFeeds = [...linkFeeds, ...heuristicFeeds];
    const uniqueFeeds = allFeeds.filter(
      (feed, index, array) => array.findIndex((f) => f.url === feed.url) === index,
    );

    if (uniqueFeeds.length > 0) {
      return uniqueFeeds;
    }
  } catch (error) {
    // If HTML fetching fails, continue to fallback methods
    console.warn(`Failed to fetch HTML from ${url}:`, error);
  }

  // Fallback: try common RSS paths
  const fallbackFeed = await tryCommonPaths(url, mergedOptions);
  if (fallbackFeed) {
    return [fallbackFeed];
  }

  // No feeds found
  return [];
}

/**
 * Export individual service checkers for direct use
 */
export { SERVICES as services } from './services.js';
