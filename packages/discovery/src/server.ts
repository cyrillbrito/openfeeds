import { JSDOM } from 'jsdom';
import {
  checkKnownServices,
  COMMON_FEED_PATHS,
  dedupeFeeds,
  DEFAULT_DISCOVERY_OPTIONS,
  extractFeedLinks,
  extractHeuristicFeeds,
  isSupportedProtocol,
  normalizeUrl,
  shouldSkipUrl,
  type DiscoveredFeed,
  type DiscoveryOptions,
} from './core/index.js';

export type {
  DiscoveryOptions,
  DiscoveredFeed,
  Feed,
  ServiceResult,
  ExtractOptions,
} from './core/index.js';
export { checkKnownServices, SERVICES } from './core/index.js';

type DiscoverySource =
  | 'self_feed'
  | 'known_service'
  | 'html_alternate'
  | 'heuristic_link'
  | 'common_path';

type DiscoveryCandidate = DiscoveredFeed & {
  score: number;
  source: DiscoverySource;
};

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
]);

export async function discoverFeeds(
  url: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveredFeed[]> {
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

  let dom: JSDOM | null = null;
  try {
    const html = await fetchHtmlContent(url, mergedOptions);
    dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const document = dom.window.document;

    const linkFeeds = extractFeedLinks(document, { baseUrl: url });
    const heuristicFeeds = extractHeuristicFeeds(document, { baseUrl: url });
    const uniqueFeeds = dedupeFeeds([...linkFeeds, ...heuristicFeeds]);

    if (uniqueFeeds.length > 0) {
      return uniqueFeeds;
    }
  } catch (error) {
    console.warn(`Failed to fetch HTML from ${url}:`, error);
  } finally {
    dom?.window.close();
  }

  const fallbackFeed = await tryCommonPaths(url, mergedOptions);
  if (fallbackFeed) {
    return [fallbackFeed];
  }

  return [];
}

export async function discoverFeedsEnhanced(
  url: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveredFeed[]> {
  const mergedOptions = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };

  if (!isSupportedProtocol(url)) {
    throw new Error(`Unsupported protocol: ${url}`);
  }

  const selfFeed = await checkSelfRssFeed(url, mergedOptions);
  if (selfFeed) {
    return [selfFeed];
  }

  const candidates: DiscoveryCandidate[] = [];

  const knownServiceResult = checkKnownServices(url);
  if (knownServiceResult && knownServiceResult.feeds.length > 0) {
    candidates.push(
      ...knownServiceResult.feeds.map((feed) => ({
        ...feed,
        score: 0.9,
        source: 'known_service' as const,
      })),
    );
  }

  let dom: JSDOM | null = null;
  try {
    const html = await fetchHtmlContent(url, mergedOptions);
    dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const document = dom.window.document;

    const linkFeeds = extractFeedLinks(document, { baseUrl: url }).map((feed) => ({
      ...feed,
      score: 0.85,
      source: 'html_alternate' as const,
    }));

    const heuristicFeeds = extractHeuristicFeeds(document, { baseUrl: url }).map((feed) => ({
      ...feed,
      score: 0.55,
      source: 'heuristic_link' as const,
    }));

    candidates.push(...linkFeeds, ...heuristicFeeds);
  } catch {
    // Skip HTML failures; fallback candidates below.
  } finally {
    dom?.window.close();
  }

  if (candidates.length === 0) {
    const urlObj = new URL(url);
    candidates.push(
      ...COMMON_FEED_PATHS.map((path) => ({
        url: urlObj.origin + path,
        title: urlObj.origin + path,
        score: 0.35,
        source: 'common_path' as const,
      })),
    );
  }

  const normalized = dedupeAndNormalizeCandidates(candidates).slice(0, mergedOptions.maxCandidates);
  if (normalized.length === 0) return [];

  const verified = await verifyCandidates(normalized, mergedOptions);
  return sortFeedsForDisplay(dedupeEquivalentFeeds(verified)).map(toPublicFeed);
}

function dedupeAndNormalizeCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const byCanonicalUrl = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    if (shouldSkipUrl(candidate.url)) continue;

    const canonicalUrl = canonicalizeFeedUrl(candidate.url);
    const existing = byCanonicalUrl.get(canonicalUrl);
    if (!existing || candidate.score > existing.score) {
      byCanonicalUrl.set(canonicalUrl, { ...candidate, url: canonicalUrl });
    }
  }

  return Array.from(byCanonicalUrl.values());
}

function canonicalizeFeedUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
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

async function verifyCandidates(
  candidates: DiscoveryCandidate[],
  options: Required<DiscoveryOptions>,
): Promise<DiscoveryCandidate[]> {
  const verifiedCandidates = await runWithConcurrency(
    candidates,
    options.verificationConcurrency,
    (candidate) => verifyCandidate(candidate, options),
  );

  const valid = verifiedCandidates.filter(
    (candidate): candidate is DiscoveryCandidate => candidate !== null,
  );
  return valid;
}

async function verifyCandidate(
  candidate: DiscoveryCandidate,
  options: Required<DiscoveryOptions>,
): Promise<DiscoveryCandidate | null> {
  const response = await fetchWithTimeout(candidate.url, options, options.timeout, {
    Accept:
      'application/rss+xml,application/atom+xml,application/feed+json,application/xml,text/xml,application/json,text/html;q=0.8,*/*;q=0.5',
  });

  if (!response || !response.ok || response.status >= 400) {
    return fallbackLikely(candidate);
  }

  const content = await response.text();
  const contentType = response.headers?.get?.('content-type') || candidate.type || '';
  if (!isValidFeedContent(content, contentType)) {
    return fallbackLikely(candidate);
  }

  const metadata = extractFeedMetadata(content, contentType);
  const siteMetadata = metadata.siteUrl
    ? await extractSiteMetadata(metadata.siteUrl, options)
    : undefined;
  const icon = metadata.icon || siteMetadata?.icon;
  const verified: DiscoveryCandidate = {
    ...candidate,
    url: response.url ? canonicalizeFeedUrl(response.url) : candidate.url,
    title: metadata.title || candidate.title || candidate.url,
    type: normalizeFeedType(contentType) || candidate.type,
    score: Math.min(1, Math.max(0.85, candidate.score + 0.2)),
    description: metadata.description || siteMetadata?.description,
    siteUrl: metadata.siteUrl,
    icon,
  };

  return verified;
}

function fallbackLikely(candidate: DiscoveryCandidate): DiscoveryCandidate | null {
  if (candidate.source !== 'known_service' && candidate.source !== 'html_alternate') {
    return null;
  }

  return {
    ...candidate,
    score: Math.max(0.4, candidate.score - 0.25),
  };
}

function sortFeedsForDisplay(feeds: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return feeds.toSorted((a, b) => b.score - a.score);
}

function dedupeEquivalentFeeds(feeds: DiscoveryCandidate[]): DiscoveryCandidate[] {
  if (feeds.length <= 1) return feeds;

  const canonical = new Map<string, DiscoveryCandidate>();
  for (const feed of feeds) {
    const key = canonicalizeFeedUrl(feed.url);
    const existing = canonical.get(key);
    if (!existing || scoreFeed(feed) > scoreFeed(existing)) {
      canonical.set(key, feed);
    }
  }

  const byMeta = new Map<string, DiscoveryCandidate>();
  for (const feed of canonical.values()) {
    const key = equivalentMetaKey(feed);
    if (!key) {
      byMeta.set(feed.url, feed);
      continue;
    }

    const existing = byMeta.get(key);
    if (!existing || scoreFeed(feed) > scoreFeed(existing)) {
      byMeta.set(key, feed);
    }
  }

  return Array.from(byMeta.values());
}

function equivalentMetaKey(feed: DiscoveryCandidate): string | null {
  try {
    const siteHost = feed.siteUrl ? new URL(feed.siteUrl).hostname.replace(/^www\./, '') : '';
    const parsed = new URL(feed.url);
    const host = parsed.hostname.replace(/^www\./, '');
    const title = feed.title.trim().toLowerCase();
    const type = feed.type ? normalizeTypeFamily(feed.type) : '';

    if (siteHost && title) {
      return `${siteHost}|${title}|${type}`;
    }

    if (host && title) {
      return `${host}|${title}|${type}`;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeTypeFamily(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('rss')) return 'rss';
  if (lower.includes('atom')) return 'atom';
  if (lower.includes('json')) return 'json';
  return lower;
}

function scoreFeed(feed: DiscoveryCandidate): number {
  const score = feed.score;
  const hasNoQuery = feed.url.includes('?') ? 0 : 0.05;
  const shorter = 1 / Math.max(20, feed.url.length);
  return score + hasNoQuery + shorter;
}

function toPublicFeed(candidate: DiscoveryCandidate): DiscoveredFeed {
  const { score: _score, source: _source, ...publicFeed } = candidate;
  return publicFeed;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: (R | undefined)[] = Array.from({ length: items.length });
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const item = items[currentIndex];
      if (item === undefined) return;
      results[currentIndex] = await handler(item);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results.filter((item): item is R => item !== undefined);
}

async function fetchWithTimeout(
  url: string,
  options: Required<DiscoveryOptions>,
  timeout: number,
  extraHeaders: Record<string, string>,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': options.userAgent,
        ...extraHeaders,
      },
      signal: controller.signal,
      redirect: options.followRedirects ? 'follow' : 'manual',
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHtmlContent(url: string, options: Required<DiscoveryOptions>): Promise<string> {
  const response = await fetchWithTimeout(url, options, options.timeout, {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });

  if (!response || !response.ok) {
    throw new Error('Failed to fetch HTML');
  }

  return await response.text();
}

async function checkSelfRssFeed(
  url: string,
  options: Required<DiscoveryOptions>,
): Promise<DiscoveredFeed | null> {
  const response = await fetchWithTimeout(url, options, options.timeout, {
    Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,application/json',
  });

  if (!response || !response.ok) {
    return null;
  }

  const content = await response.text();
  const contentType = response.headers?.get?.('content-type') || '';
  if (!isValidFeedContent(content, contentType)) {
    return null;
  }

  const metadata = extractFeedMetadata(content, contentType);
  return {
    url,
    title: metadata.title || url,
    type: normalizeFeedType(contentType),
    description: metadata.description,
    siteUrl: metadata.siteUrl,
    icon: metadata.icon,
  };
}

async function tryCommonPaths(
  baseUrl: string,
  options: Required<DiscoveryOptions>,
): Promise<DiscoveredFeed | null> {
  const urlObj = new URL(baseUrl);

  for (const path of COMMON_FEED_PATHS) {
    try {
      const feedUrl = urlObj.origin + path;
      const response = await fetchWithTimeout(feedUrl, options, Math.min(options.timeout, 5000), {
        Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml',
      });

      if (response && response.ok && response.status >= 200 && response.status < 400) {
        const content = await response.text();
        const contentType = response.headers?.get?.('content-type') || '';

        if (isValidFeedContent(content, contentType)) {
          return {
            url: feedUrl,
            title: feedUrl,
            type: normalizeFeedType(contentType),
          };
        }
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
      return Boolean(json.version && json.items && Array.isArray(json.items));
    } catch {
      return false;
    }
  }

  return false;
}

function normalizeFeedType(contentType: string): string | undefined {
  const lower = contentType.toLowerCase();
  if (lower.includes('application/rss+xml')) return 'application/rss+xml';
  if (lower.includes('application/atom+xml')) return 'application/atom+xml';
  if (lower.includes('application/feed+json')) return 'application/feed+json';
  if (lower.includes('application/json')) return 'application/json';
  return contentType || undefined;
}

function extractFeedMetadata(
  content: string,
  contentType: string,
): {
  title?: string;
  description?: string;
  siteUrl?: string;
  icon?: string;
} {
  if (contentType.includes('json') || content.trim().startsWith('{')) {
    try {
      const json = JSON.parse(content) as {
        title?: string;
        description?: string;
        home_page_url?: string;
        favicon?: string;
      };

      return {
        title: json.title,
        description: json.description,
        siteUrl: json.home_page_url,
        icon: json.favicon,
      };
    } catch {
      return {};
    }
  }

  return {
    title: extractXmlTag(content, 'title') ?? undefined,
    description:
      extractXmlTag(content, 'description') ?? extractXmlTag(content, 'subtitle') ?? undefined,
    siteUrl: extractAtomAlternateLink(content) ?? extractXmlTag(content, 'link') ?? undefined,
    icon: extractXmlTag(content, 'icon') ?? undefined,
  };
}

function extractAtomAlternateLink(content: string): string | undefined {
  const match = content.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1];
}

async function extractSiteMetadata(
  siteUrl: string,
  options: Required<DiscoveryOptions>,
): Promise<{ icon?: string; description?: string }> {
  const response = await fetchWithTimeout(siteUrl, options, Math.min(options.timeout, 3000), {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });

  if (!response || !response.ok) return {};

  const html = await response.text();
  const descriptionPatterns = [
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ];

  let description: string | undefined;
  for (const pattern of descriptionPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      description = decodeHtml(match[1]);
      break;
    }
  }

  const patterns = [
    /<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*rel=["'](?:shortcut\s+icon|icon)["'][^>]*href=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    try {
      return {
        icon: new URL(match[1], siteUrl).toString(),
        description,
      };
    } catch {
      continue;
    }
  }

  try {
    return {
      icon: `${new URL(siteUrl).origin}/favicon.ico`,
      description,
    };
  } catch {
    return { description };
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractXmlTag(content: string, tagName: string): string | null {
  const cleanContent = content.replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = cleanContent.match(regex);

  if (!match || !match[1]) {
    return null;
  }

  let value = match[1];
  value = value.replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1');
  value = value.replace(/<[^>]+>/g, ' ');
  value = value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  value = value.replace(/\s+/g, ' ').trim();

  return value || null;
}
