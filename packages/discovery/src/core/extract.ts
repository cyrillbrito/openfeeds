import { RSS_MIME_TYPES } from './constants.js';
import type { ExtractOptions, Feed } from './types.js';
import { normalizeUrl, shouldSkipUrl } from './utils.js';

export function extractFeedLinks(document: Document, options: ExtractOptions): Feed[] {
  const feeds: Feed[] = [];
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]');

  for (const link of links) {
    const type = link.getAttribute('type')?.toLowerCase() || '';
    const href = link.getAttribute('href');

    if (!href) continue;

    const isFeedType = RSS_MIME_TYPES.some((mimeType) => type.includes(mimeType));
    if (!isFeedType) continue;

    const absoluteUrl = normalizeUrl(href, options.baseUrl);
    if (shouldSkipUrl(absoluteUrl)) continue;

    feeds.push({
      url: absoluteUrl,
      title: link.getAttribute('title') || extractTitleFromUrl(href),
      type,
    });
  }

  return feeds;
}

export function extractHeuristicFeeds(document: Document, options: ExtractOptions): Feed[] {
  const feeds: Feed[] = [];
  const seenUrls = new Set<string>();
  const rssPattern = /([^a-zA-Z]|^)rss([^a-zA-Z]|$)/i;

  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) continue;

    const absoluteUrl = normalizeUrl(href, options.baseUrl);
    if (seenUrls.has(absoluteUrl)) continue;

    const hrefLower = href.toLowerCase();
    const text = anchor.textContent?.toLowerCase() || '';
    const title = anchor.getAttribute('title')?.toLowerCase() || '';
    const className = anchor.getAttribute('class')?.toLowerCase() || '';

    const looksLikeFeedUrl =
      hrefLower.includes('/feed') ||
      hrefLower.includes('/rss') ||
      hrefLower.includes('/atom') ||
      hrefLower.endsWith('.xml') ||
      hrefLower.endsWith('.rss') ||
      hrefLower.endsWith('.atom');

    const looksLikeFeedText =
      rssPattern.test(text) ||
      rssPattern.test(title) ||
      rssPattern.test(className) ||
      text.includes('feed') ||
      text.includes('subscribe');

    if ((looksLikeFeedUrl || looksLikeFeedText) && !shouldSkipUrl(absoluteUrl)) {
      seenUrls.add(absoluteUrl);
      feeds.push({
        url: absoluteUrl,
        title:
          anchor.getAttribute('title') || anchor.textContent?.trim() || extractTitleFromUrl(href),
        type: 'potential',
      });
    }
  }

  return feeds;
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url, 'https://example.com');
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || 'Feed';

    return lastPart
      .replace(/\.(xml|rss|atom|json)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'Feed';
  }
}
