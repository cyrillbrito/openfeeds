#!/usr/bin/env bun

/**
 * Generates curated feed data for the discovery page.
 *
 * Sources feed lists from the awesome-rss-feeds repo (CC0 license),
 * validates each feed URL, enriches with metadata (title, description, image),
 * and outputs a JSON file consumed by the web app.
 *
 * Usage: bun generate-curated-feeds
 */
import { parseFeed, parseOpml } from 'feedsmith';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GITHUB_API_BASE = 'https://api.github.com/repos/plenaryapp/awesome-rss-feeds';
const RAW_BASE = 'https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master';
const OPML_DIR = 'recommended/with_category';
const OUTPUT_PATH = new URL('../../../apps/web/src/data/curated-feeds.json', import.meta.url)
  .pathname;

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 15_000;
const METADATA_TIMEOUT_MS = 10_000;

// Use a realistic browser User-Agent to avoid 403s from bot-blocking CDNs
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const FEED_FETCH_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
};

const HTML_FETCH_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Category display order — listed categories appear first in this order,
// unlisted ones are appended alphabetically at the end.
const CATEGORY_ORDER: string[] = [
  'News',
  'Tech',
  'Science',
  'Programming',
  'Gaming',
  'Music',
  'Movies',
  'Television',
  'Books',
  'Funny',
  'Sports',
  'Football',
  'Cricket',
  'Tennis',
  'Food',
  'Travel',
  'Photography',
  'Business & Economy',
  'Personal finance',
  'Startups',
  'Fashion',
  'Beauty',
  'Apple',
  'Android',
  'iOS Development',
  'Android Development',
  'Web Development',
  'UI / UX',
  'Space',
  'History',
  'DIY',
  'Architecture',
  'Interior design',
  'Cars',
];

// Category icons — map category names to Lucide icon component names.
// These names are resolved to actual Lucide components in CuratedFeedsBrowser.tsx.
const CATEGORY_ICONS: Record<string, string> = {
  Android: 'Smartphone',
  'Android Development': 'Smartphone',
  Apple: 'Apple',
  Architecture: 'Building2',
  Beauty: 'Sparkles',
  Books: 'BookOpen',
  'Business & Economy': 'Briefcase',
  Cars: 'Car',
  Cricket: 'Trophy',
  'Interior design': 'Armchair',
  DIY: 'Hammer',
  Fashion: 'Shirt',
  Food: 'UtensilsCrossed',
  Football: 'Trophy',
  Funny: 'Laugh',
  Gaming: 'Gamepad2',
  History: 'Landmark',
  'iOS Development': 'Smartphone',
  Movies: 'Clapperboard',
  Music: 'Music',
  News: 'Newspaper',
  'Personal finance': 'Wallet',
  Photography: 'Camera',
  Programming: 'Code',
  Science: 'FlaskConical',
  Space: 'Telescope',
  Sports: 'Medal',
  Startups: 'Rocket',
  Tech: 'MonitorSmartphone',
  Television: 'Tv',
  Tennis: 'Trophy',
  Travel: 'Plane',
  'UI / UX': 'Palette',
  'Web Development': 'Globe',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CuratedFeed {
  title: string;
  description: string | null;
  feedUrl: string;
  siteUrl: string;
  imageUrl: string | null;
}

interface CuratedCategory {
  name: string;
  slug: string;
  icon: string;
  feedCount: number;
  feeds: CuratedFeed[];
}

interface RawFeedEntry {
  title: string;
  description: string;
  feedUrl: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  headers: Record<string, string> = HTML_FETCH_HEADERS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Run async tasks with bounded concurrency */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// HTML entities map
const htmlEntities: Record<string, string> = {
  nbsp: ' ',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  apos: "'",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&([^;]+);/g, (match, entity) => {
    if (htmlEntities[entity]) return htmlEntities[entity];
    if (entity.startsWith('#')) {
      const code = entity.startsWith('#x')
        ? parseInt(entity.substring(2), 16)
        : parseInt(entity.substring(1), 10);
      return String.fromCharCode(code);
    }
    return match;
  });
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function cleanText(text: string | undefined | null): string | null {
  if (!text) return null;
  const cleaned = stripHtml(decodeHtmlEntities(text)).trim();
  return cleaned || null;
}

// ---------------------------------------------------------------------------
// Step 1: Fetch OPML file list from GitHub
// ---------------------------------------------------------------------------

async function fetchOpmlFileList(): Promise<string[]> {
  console.log('Fetching OPML file list from GitHub...');

  const url = `${GITHUB_API_BASE}/contents/${OPML_DIR}`;
  const response = await fetchWithTimeout(url, 10_000);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const files = (await response.json()) as Array<{ name: string; download_url: string }>;
  const opmlFiles = files.filter((f) => f.name.endsWith('.opml')).map((f) => f.name);

  console.log(`  Found ${opmlFiles.length} OPML files`);
  return opmlFiles;
}

// ---------------------------------------------------------------------------
// Step 2: Fetch and parse OPML files
// ---------------------------------------------------------------------------

async function fetchAndParseOpmls(fileNames: string[]): Promise<RawFeedEntry[]> {
  console.log(`\nFetching and parsing ${fileNames.length} OPML files...`);

  const allEntries: RawFeedEntry[] = [];

  for (const fileName of fileNames) {
    const categoryName = fileName.replace('.opml', '');
    const url = `${RAW_BASE}/${OPML_DIR}/${encodeURIComponent(fileName)}`;

    try {
      const response = await fetchWithTimeout(url, 10_000);
      if (!response.ok) {
        console.log(`  SKIP ${categoryName}: HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const feeds: RawFeedEntry[] = [];

      // Try feedsmith first, fall back to regex for files with special chars
      let parsed = false;
      try {
        const opml = parseOpml(xml);
        const outlines = opml.body?.outlines ?? [];

        function extractFeeds(items: typeof outlines, fallbackCategory: string) {
          for (const item of items) {
            if (item.xmlUrl) {
              feeds.push({
                title: item.title || item.text || 'Unknown',
                description: item.description || '',
                feedUrl: item.xmlUrl,
                category: fallbackCategory,
              });
            }
            if (item.outlines) {
              extractFeeds(item.outlines, item.text || item.title || fallbackCategory);
            }
          }
        }
        extractFeeds(outlines, categoryName);
        parsed = true;
        console.log(`  ${categoryName}: ${feeds.length} feeds`);
      } catch {
        // feedsmith can fail on OPML with special Unicode characters — fall back to regex
        const outlineRegex = /<outline\s[^>]*xmlUrl=["']([^"']+)["'][^>]*/gi;
        let match: RegExpExecArray | null;
        while ((match = outlineRegex.exec(xml)) !== null) {
          const fullTag = match[0];
          const xmlUrl = match[1];
          const titleMatch = fullTag.match(/\btitle=["']([^"']*?)["']/i);
          const descMatch = fullTag.match(/\bdescription=["']([^"']*?)["']/i);
          feeds.push({
            title: titleMatch?.[1] || 'Unknown',
            description: descMatch?.[1] || '',
            feedUrl: xmlUrl,
            category: categoryName,
          });
        }
        if (feeds.length > 0) {
          parsed = true;
          console.log(`  ${categoryName}: ${feeds.length} feeds (regex fallback)`);
        }
      }

      if (parsed && feeds.length > 0) {
        allEntries.push(...feeds);
      } else {
        console.log(`  SKIP ${categoryName}: no feeds found`);
      }
    } catch (err) {
      console.log(`  FAIL ${categoryName}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Deduplicate by feedUrl (some feeds appear in multiple OPMLs)
  const seen = new Set<string>();
  const unique: RawFeedEntry[] = [];
  for (const entry of allEntries) {
    const key = entry.feedUrl.toLowerCase().replace(/\/$/, '');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }

  console.log(`\n  Total: ${allEntries.length} raw entries, ${unique.length} unique feeds`);
  return allEntries; // Keep all — dedup per category later
}

// ---------------------------------------------------------------------------
// Step 3: Validate feeds (strict — must parse as RSS/Atom)
// ---------------------------------------------------------------------------

interface ValidatedFeed {
  feedUrl: string;
  siteUrl: string;
  title: string;
  description: string | null;
  category: string;
  /** Image URL extracted from the feed XML itself (channel/image, logo, icon) */
  feedImageUrl: string | null;
}

function extractWebsiteUrl(feedResult: ReturnType<typeof parseFeed>): string | null {
  if (feedResult.format === 'rss') {
    return feedResult.feed.link ?? null;
  }
  if (feedResult.format === 'atom') {
    const link = feedResult.feed.links?.find((l) => l.rel !== 'self') ?? feedResult.feed.links?.[0];
    return link?.href ?? null;
  }
  if (feedResult.format === 'rdf') {
    return feedResult.feed.link ?? null;
  }
  if (feedResult.format === 'json') {
    return feedResult.feed.home_page_url ?? null;
  }
  return null;
}

function extractFeedTitle(feedResult: ReturnType<typeof parseFeed>): string | null {
  const feed = feedResult.feed as Record<string, unknown>;
  return (feed.title as string) ?? null;
}

function extractFeedDescription(feedResult: ReturnType<typeof parseFeed>): string | null {
  const feed = feedResult.feed as Record<string, unknown>;
  return (feed.description as string) ?? (feed.subtitle as string) ?? null;
}

async function validateFeeds(entries: RawFeedEntry[]): Promise<ValidatedFeed[]> {
  console.log(`\nValidating ${entries.length} feeds (concurrency=${CONCURRENCY})...`);

  let validated = 0;
  let dropped = 0;

  const results = await mapConcurrent(entries, CONCURRENCY, async (entry, i) => {
    const progress = `[${i + 1}/${entries.length}]`;
    try {
      const response = await fetchWithTimeout(entry.feedUrl, FETCH_TIMEOUT_MS, FEED_FETCH_HEADERS);
      if (!response.ok) {
        console.log(`  ${progress} DROP ${entry.title}: HTTP ${response.status}`);
        dropped++;
        return null;
      }

      const xml = await response.text();
      const feedResult = parseFeed(xml);

      const siteUrl = extractWebsiteUrl(feedResult) ?? '';
      const title = cleanText(extractFeedTitle(feedResult)) || entry.title;
      const description =
        cleanText(extractFeedDescription(feedResult)) || cleanText(entry.description);
      const feedImageUrl = extractFeedImage(feedResult);

      validated++;
      if (validated % 20 === 0) {
        console.log(`  ${progress} Validated ${validated} so far...`);
      }

      return {
        feedUrl: entry.feedUrl,
        siteUrl,
        title,
        description,
        category: entry.category,
        feedImageUrl,
      } satisfies ValidatedFeed;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const short = reason.length > 60 ? `${reason.slice(0, 60)}...` : reason;
      console.log(`  ${progress} DROP ${entry.title}: ${short}`);
      dropped++;
      return null;
    }
  });

  const valid = results.filter((r): r is ValidatedFeed => r !== null);
  console.log(`\n  Validated: ${valid.length}, Dropped: ${dropped}`);
  return valid;
}

// ---------------------------------------------------------------------------
// Step 4: Enrich with website metadata (OG tags)
// ---------------------------------------------------------------------------

interface EnrichedFeed extends ValidatedFeed {
  imageUrl: string | null;
}

/** Try to resolve a potentially relative URL against a base */
function resolveUrl(url: string, base: string): string | null {
  if (url.startsWith('http')) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

/**
 * Extract an image URL from a website, trying multiple strategies:
 * 1. og:image meta tag
 * 2. twitter:image meta tag
 * 3. <link rel="apple-touch-icon"> (usually a high-res square icon)
 * 4. <link rel="icon"> with size >= 64px
 */
async function extractImage(siteUrl: string): Promise<string | null> {
  if (!siteUrl) return null;

  try {
    const response = await fetchWithTimeout(siteUrl, METADATA_TIMEOUT_MS, HTML_FETCH_HEADERS);
    if (!response.ok) return null;

    const html = await response.text();

    // 1. OG image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    );
    if (ogImageMatch?.[1]) {
      const resolved = resolveUrl(ogImageMatch[1], siteUrl);
      if (resolved) return resolved;
    }
    // Also try reversed attribute order (content before property)
    const ogImageMatchAlt = html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    );
    if (ogImageMatchAlt?.[1]) {
      const resolved = resolveUrl(ogImageMatchAlt[1], siteUrl);
      if (resolved) return resolved;
    }

    // 2. twitter:image
    const twitterImageMatch = html.match(
      /<meta[^>]*(?:name|property)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    );
    if (twitterImageMatch?.[1]) {
      const resolved = resolveUrl(twitterImageMatch[1], siteUrl);
      if (resolved) return resolved;
    }
    const twitterImageMatchAlt = html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']twitter:image(?::src)?["']/i,
    );
    if (twitterImageMatchAlt?.[1]) {
      const resolved = resolveUrl(twitterImageMatchAlt[1], siteUrl);
      if (resolved) return resolved;
    }

    // 3. apple-touch-icon (high-res square icon, good fallback)
    const appleTouchMatch = html.match(
      /<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i,
    );
    if (appleTouchMatch?.[1]) {
      const resolved = resolveUrl(appleTouchMatch[1], siteUrl);
      if (resolved) return resolved;
    }

    // 4. Large favicon (icon with sizes >= 64)
    const iconMatches = html.matchAll(
      /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    );
    for (const match of iconMatches) {
      const fullTag = match[0];
      const sizeMatch = fullTag.match(/sizes=["'](\d+)x(\d+)["']/i);
      if (sizeMatch && parseInt(sizeMatch[1]) >= 64) {
        const resolved = resolveUrl(match[1], siteUrl);
        if (resolved) return resolved;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract image URL from the RSS/Atom feed itself.
 * Many feeds have a <channel><image><url> or <logo> element.
 */
function extractFeedImage(feedResult: ReturnType<typeof parseFeed>): string | null {
  if (feedResult.format === 'rss') {
    const feed = feedResult.feed as Record<string, unknown>;
    const image = feed.image as Record<string, unknown> | undefined;
    if (image?.url && typeof image.url === 'string') return image.url;
  }
  if (feedResult.format === 'atom') {
    const feed = feedResult.feed as Record<string, unknown>;
    if (typeof feed.logo === 'string') return feed.logo;
    if (typeof feed.icon === 'string') return feed.icon;
  }
  return null;
}

async function enrichFeeds(feeds: ValidatedFeed[]): Promise<EnrichedFeed[]> {
  console.log(
    `\nEnriching ${feeds.length} feeds with website metadata (concurrency=${CONCURRENCY})...`,
  );

  let enriched = 0;
  let withImage = 0;

  const results = await mapConcurrent(feeds, CONCURRENCY, async (feed, i) => {
    // Try website OG/twitter/icon first, fall back to feed-level image
    const imageUrl = (await extractImage(feed.siteUrl)) ?? feed.feedImageUrl;

    enriched++;
    if (imageUrl) withImage++;
    if (enriched % 20 === 0) {
      console.log(
        `  [${i + 1}/${feeds.length}] Enriched ${enriched} so far (${withImage} with images)...`,
      );
    }

    return { ...feed, imageUrl };
  });

  console.log(`\n  Enriched: ${enriched}, With images: ${withImage}`);
  return results;
}

// ---------------------------------------------------------------------------
// Step 5: Build output JSON
// ---------------------------------------------------------------------------

function buildOutput(feeds: EnrichedFeed[]): CuratedCategory[] {
  // Group by category
  const categoryMap = new Map<string, EnrichedFeed[]>();
  for (const feed of feeds) {
    const existing = categoryMap.get(feed.category) || [];
    existing.push(feed);
    categoryMap.set(feed.category, existing);
  }

  // Sort categories by CATEGORY_ORDER priority, then alphabetically for unlisted ones
  const orderIndex = new Map(CATEGORY_ORDER.map((name, i) => [name, i]));
  const sortedEntries = [...categoryMap.entries()].sort(([a], [b]) => {
    const aIdx = orderIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bIdx = orderIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });

  const categories: CuratedCategory[] = [];
  for (const [name, categoryFeeds] of sortedEntries) {
    // Deduplicate feeds within a category by feedUrl
    const seen = new Set<string>();
    const uniqueFeeds: CuratedFeed[] = [];
    for (const f of categoryFeeds) {
      const key = f.feedUrl.toLowerCase().replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueFeeds.push({
        title: f.title,
        description: f.description,
        feedUrl: f.feedUrl,
        siteUrl: f.siteUrl,
        imageUrl: f.imageUrl,
      });
    }

    // Sort feeds alphabetically within category
    uniqueFeeds.sort((a, b) => a.title.localeCompare(b.title));

    categories.push({
      name,
      slug: slugify(name),
      icon: CATEGORY_ICONS[name] || 'Rss',
      feedCount: uniqueFeeds.length,
      feeds: uniqueFeeds,
    });
  }

  return categories;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = performance.now();
  console.log('=== Generate Curated Feeds ===\n');

  // Step 1: Get list of OPML files
  const opmlFiles = await fetchOpmlFileList();

  // Step 2: Fetch and parse all OPMLs
  const rawEntries = await fetchAndParseOpmls(opmlFiles);

  // Step 3: Validate each feed (strict)
  const validatedFeeds = await validateFeeds(rawEntries);

  // Step 4: Enrich with metadata
  const enrichedFeeds = await enrichFeeds(validatedFeeds);

  // Step 5: Build output
  const categories = buildOutput(enrichedFeeds);
  const totalFeeds = categories.reduce((sum, c) => sum + c.feedCount, 0);

  // Step 6: Write JSON
  const output = JSON.stringify(categories, null, 2);
  await Bun.write(OUTPUT_PATH, output);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Done ===');
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Feeds: ${totalFeeds}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
  console.log(`  Size: ${(output.length / 1024).toFixed(1)} KB`);
  console.log(`  Time: ${elapsed}s`);
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
