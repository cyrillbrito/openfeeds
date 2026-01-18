import { Window } from 'happy-dom';
import {
  checkKnownServices,
  COMMON_FEED_PATHS,
  dedupeFeeds,
  DEFAULT_DISCOVERY_OPTIONS,
  extractFeedLinks,
  extractHeuristicFeeds,
  isSupportedProtocol,
  type DiscoveryOptions,
  type Feed,
} from './core/index.js';

export type { DiscoveryOptions, Feed, ServiceResult, ExtractOptions } from './core/index.js';
export { checkKnownServices, SERVICES } from './core/index.js';

export async function discoverFeeds(url: string, options: DiscoveryOptions = {}): Promise<Feed[]> {
  const mergedOptions = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };

  if (!isSupportedProtocol(url)) {
    throw new Error(`Unsupported protocol: ${url}`);
  }

  const knownServiceResult = checkKnownServices(url);
  if (knownServiceResult && knownServiceResult.feeds.length > 0) {
    return knownServiceResult.feeds;
  }

  const selfFeed = await checkSelfRssFeed(url, mergedOptions);
  if (selfFeed) {
    return [selfFeed];
  }

  let window: Window | null = null;
  try {
    const html = await fetchHtmlContent(url, mergedOptions);
    window = new Window({
      url,
      settings: {
        disableJavaScriptEvaluation: true,
        disableJavaScriptFileLoading: true,
        disableCSSFileLoading: true,
      },
    });
    window.document.body.innerHTML = html;
    const document = window.document as unknown as Document;

    const linkFeeds = extractFeedLinks(document, { baseUrl: url });
    const heuristicFeeds = extractHeuristicFeeds(document, { baseUrl: url });

    const uniqueFeeds = dedupeFeeds([...linkFeeds, ...heuristicFeeds]);

    if (uniqueFeeds.length > 0) {
      return uniqueFeeds;
    }
  } catch (error) {
    console.warn(`Failed to fetch HTML from ${url}:`, error);
  } finally {
    window?.close();
  }

  const fallbackFeed = await tryCommonPaths(url, mergedOptions);
  if (fallbackFeed) {
    return [fallbackFeed];
  }

  return [];
}

async function fetchHtmlContent(url: string, options: Required<DiscoveryOptions>): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': options.userAgent,
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

async function checkSelfRssFeed(
  url: string,
  options: Required<DiscoveryOptions>,
): Promise<Feed | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent,
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
  } catch {}

  return null;
}

async function tryCommonPaths(
  baseUrl: string,
  options: Required<DiscoveryOptions>,
): Promise<Feed | null> {
  const urlObj = new URL(baseUrl);

  for (const path of COMMON_FEED_PATHS) {
    try {
      const feedUrl = urlObj.origin + path;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(options.timeout, 5000));

      try {
        const response = await fetch(feedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent,
            Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml',
          },
          signal: controller.signal,
          redirect: options.followRedirects ? 'follow' : 'manual',
        });

        if (response.ok && response.status >= 200 && response.status < 400) {
          const content = await response.text();
          const contentType = response.headers.get('content-type') || '';

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
      continue;
    }
  }

  return null;
}

function isValidFeedContent(content: string, contentType: string = ''): boolean {
  if (content.includes('<rss') || content.includes('<feed') || content.includes('<rdf:RDF')) {
    return true;
  }

  if (contentType.includes('json') || content.trim().startsWith('{')) {
    try {
      const json = JSON.parse(content);
      return json.version && json.items && Array.isArray(json.items);
    } catch {
      return false;
    }
  }

  return false;
}

function extractFeedTitle(content: string): string | null {
  const cleanContent = content.replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const titleMatch = cleanContent.match(/<title>(.*?)<\/title>/is);

  if (titleMatch && titleMatch[1]) {
    let title = titleMatch[1];
    title = title.replace(/<!\[CDATA\[(.*?)]]>/gs, '$1');
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    title = title.replace(/\s+/g, ' ');
    return title.trim();
  }

  return null;
}
