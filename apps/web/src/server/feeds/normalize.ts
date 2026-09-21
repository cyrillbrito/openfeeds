// feedsmith preserves each format's own structure rather than normalising,
// so this module is the adapter between it and the database.
//
// The three formats disagree about nearly everything:
//   RSS   items[]   title: string          guid: {value}   pubDate (RFC 822)
//   Atom  entries[] title: {value, type}   id: string      published/updated (ISO)
//   JSON  items[]   title: string          id: string      date_published (ISO)
// Everything downstream sees only NormalizedItem.
import 'server-only';

import { parseFeed } from 'feedsmith';

import {
  type ArticleKind,
  classifyItem,
  excerptLimitFor,
  showsExcerpt,
} from '../../lib/article-kind';
import { deriveExcerpt } from './excerpt';
import { extractMedia } from './media';

export interface NormalizedItem {
  /** Stable per-feed identity, used for dedup. Never empty. */
  guid: string;
  title: string;
  url?: string;
  author?: string;
  summary?: string;
  content?: string;
  publishedAt?: Date;
  /**
   * What the entry IS — see src/lib/article-kind.ts. Derived from the item's
   * own link and its media, so it costs no extra request.
   */
  kind: ArticleKind;
  /** The list's preview line. Absent for the kinds that show none. */
  excerpt?: string;
  imageUrl?: string;
  durationSeconds?: number;
}

/**
 * The three questions that are the same across all formats: what is this,
 * what does it look like, and what does the list show as its preview.
 *
 * `feedTitle` is the title AS THE FEED GAVE IT, before the 'Untitled'
 * substitution — its absence is what makes an item a note.
 */
function enrich(
  item: any,
  fields: {
    feedUrl: string;
    url?: string;
    feedTitle?: string;
    summary?: string;
    content?: string;
  },
): Pick<
  NormalizedItem,
  'kind' | 'excerpt' | 'imageUrl' | 'durationSeconds'
> {
  const media = extractMedia(item, {
    base: fields.feedUrl,
    url: fields.url,
    summary: fields.summary,
    content: fields.content,
  });

  const kind = classifyItem({
    url: fields.url,
    hasVideo: media.hasVideo,
    hasAudio: media.hasAudio,
    feedTitle: fields.feedTitle,
  });

  return {
    kind,
    excerpt: showsExcerpt(kind)
      ? deriveExcerpt(fields.summary, fields.content, excerptLimitFor(kind))
      : undefined,
    imageUrl: media.imageUrl,
    durationSeconds: media.durationSeconds,
  };
}

export interface NormalizedFeed {
  title: string;
  description?: string;
  /** The human-facing site, not the feed document. */
  siteUrl?: string;
  iconUrl?: string;
  items: NormalizedItem[];
}

/** Trim, collapse whitespace, and treat an empty result as absent. */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * RFC 822 (RSS) or ISO 8601 (Atom/JSON) — `new Date()` reads both. The guard
 * stops a garbage date becoming `Invalid Date` in the column.
 */
function toDate(value: unknown): Date | undefined {
  const text = clean(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Resolve a possibly-relative URL against the feed's own address. */
function absolute(url: unknown, base: string): string | undefined {
  const text = clean(url);
  if (!text) return undefined;
  try {
    return new URL(text, base).href;
  } catch {
    return undefined;
  }
}

/** Atom text constructs are `{ value, type }`; RSS gives a bare string. */
function textValue(node: unknown): string | undefined {
  if (typeof node === 'string') return clean(node);
  if (node && typeof node === 'object' && 'value' in node) {
    return clean((node as { value?: unknown }).value);
  }
  return undefined;
}

/** Atom links are `[{ href, rel }]` — `alternate` is the human page. */
function atomLink(links: unknown, base: string): string | undefined {
  if (!Array.isArray(links)) return undefined;
  const alternate = links.find(
    (l) => l?.rel === 'alternate' || l?.rel === undefined,
  );
  return absolute((alternate ?? links[0])?.href, base);
}

function firstAuthor(authors: unknown): string | undefined {
  if (!Array.isArray(authors) || authors.length === 0) return undefined;
  const author = authors[0];
  if (typeof author === 'string') return clean(author);
  return clean(author?.name) ?? clean(author?.email);
}

/**
 * The dedup key. Feeds are supposed to supply a stable one and many do not,
 * so this falls back to the URL or title — imperfect, but stable across
 * fetches of an unchanged item, which is all dedup requires.
 */
function itemGuid(candidates: Array<unknown>): string | undefined {
  for (const candidate of candidates) {
    const value = clean(candidate);
    if (value) return value;
  }
  return undefined;
}

/**
 * Parse a feed document into the shape the database stores. `feedUrl` is the
 * base for relative links. Throws when the body is not a feed at all; the
 * caller turns that into a visible per-feed error.
 */
export function normalizeFeed(body: string, feedUrl: string): NormalizedFeed {
  const { format, feed } = parseFeed(body) as { format: string; feed: any };

  if (format === 'atom') {
    const siteUrl = atomLink(feed.links, feedUrl);
    return {
      title: textValue(feed.title) ?? siteUrl ?? feedUrl,
      description: textValue(feed.subtitle),
      siteUrl,
      iconUrl: absolute(feed.icon ?? feed.logo, feedUrl),
      items: (feed.entries ?? []).map((entry: any): NormalizedItem => {
        const url = atomLink(entry.links, feedUrl);
        const title = textValue(entry.title);
        const summary = textValue(entry.summary);
        const content = textValue(entry.content);
        return {
          guid: itemGuid([entry.id, url, title]) ?? url ?? '',
          title: title ?? 'Untitled',
          url,
          author: firstAuthor(entry.authors),
          summary,
          content,
          publishedAt: toDate(entry.published) ?? toDate(entry.updated),
          ...enrich(entry, {
            feedUrl,
            url,
            feedTitle: title,
            summary,
            content,
          }),
        };
      }),
    };
  }

  if (format === 'json') {
    const siteUrl = absolute(feed.home_page_url, feedUrl);
    return {
      title: clean(feed.title) ?? siteUrl ?? feedUrl,
      description: clean(feed.description),
      siteUrl,
      iconUrl: absolute(feed.icon ?? feed.favicon, feedUrl),
      items: (feed.items ?? []).map((item: any): NormalizedItem => {
        const url = absolute(item.url ?? item.external_url, feedUrl);
        const title = clean(item.title);
        const summary = clean(item.summary);
        const content = clean(item.content_html) ?? clean(item.content_text);
        return {
          guid: itemGuid([item.id, url, title]) ?? url ?? '',
          title: title ?? 'Untitled',
          url,
          author: firstAuthor(item.authors) ?? clean(item.author?.name),
          summary,
          content,
          publishedAt: toDate(item.date_published) ?? toDate(item.date_modified),
          ...enrich(item, { feedUrl, url, feedTitle: title, summary, content }),
        };
      }),
    };
  }

  // RSS and RDF share a shape: items[], a bare-string title, and the same
  // Dublin Core / content namespaces hanging off each item.
  const siteUrl = absolute(feed.link, feedUrl);
  return {
    title: clean(feed.title) ?? siteUrl ?? feedUrl,
    description: clean(feed.description),
    siteUrl,
    iconUrl: absolute(feed.image?.url, feedUrl),
    items: (feed.items ?? []).map((item: any): NormalizedItem => {
      const url = absolute(item.link, feedUrl);
      const title = clean(item.title);
      const summary = clean(item.description);
      // content:encoded is the full body; <description> is often a teaser.
      const content = clean(item.content?.encoded);
      return {
        guid: itemGuid([item.guid?.value, url, title]) ?? url ?? '',
        title: title ?? 'Untitled',
        url,
        author: firstAuthor(item.authors) ?? clean(item.dc?.creators?.[0]),
        summary,
        content,
        publishedAt: toDate(item.pubDate) ?? toDate(item.dc?.dates?.[0]),
        ...enrich(item, { feedUrl, url, feedTitle: title, summary, content }),
      };
    }),
  };
}
