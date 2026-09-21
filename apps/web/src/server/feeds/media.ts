// The thumbnail, the duration and the video/audio signals for one parsed
// item. feedsmith already parses Media RSS, iTunes, RSS enclosures and JSON
// Feed attachments; this flattens each format's shape into one answer.
//
// The shapes, verified against node_modules/feedsmith:
//   item.media.groups[].thumbnails[]  {url, width, height}   <- YouTube
//   item.media.thumbnails[]           {url, width, height}
//   item.media.contents[]             {url, type, medium, duration}
//   item.enclosures[]                 {url, type, length}
//   item.itunes                       {image, duration}
//   JSON Feed: item.image, item.banner_image, item.attachments[]
import 'server-only';

import { youtubeThumbnailUrl, youtubeVideoId } from '../../lib/youtube';
import { decodeEntities } from './excerpt';

export interface ItemMedia {
  imageUrl?: string;
  /** Seconds. Rendered as the duration badge on video and podcast rows. */
  durationSeconds?: number;
  /** Classification signals — see lib/article-kind.ts. */
  hasVideo: boolean;
  hasAudio: boolean;
}

function positive(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? Math.round(n)
    : undefined;
}

function absolute(url: unknown, base: string): string | undefined {
  if (typeof url !== 'string' || url.trim().length === 0) return undefined;
  try {
    return new URL(url.trim(), base).href;
  } catch {
    return undefined;
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** iTunes durations come as seconds, `mm:ss` or `hh:mm:ss`. */
export function parseDuration(value: unknown): number | undefined {
  if (typeof value === 'number') return positive(value);
  if (typeof value !== 'string') return undefined;

  const text = value.trim();
  if (/^\d+$/.test(text)) return positive(Number(text));

  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (!parts.every((part) => /^\d{1,2}$/.test(part.trim()))) return undefined;

  return positive(
    parts.reduce((total, part) => total * 60 + Number(part.trim()), 0),
  );
}

/**
 * The largest thumbnail in a Media RSS list. Feeds offer them smallest-first
 * as often as not, and a 120px image in a 16:9 box looks worse than none.
 * Undeclared sizes sort last rather than being dropped.
 */
function bestThumbnail(thumbnails: unknown, base: string): string | undefined {
  let best: { url: string; width: number } | undefined;

  for (const thumbnail of asArray(thumbnails)) {
    const url = absolute(thumbnail?.url, base);
    if (!url) continue;
    const width = positive(thumbnail?.width) ?? 0;
    if (!best || width > best.width) best = { url, width };
  }

  return best?.url;
}

/** Media RSS hangs the same elements off the item and off each group. */
function mediaSources(media: unknown): any[] {
  if (!media || typeof media !== 'object') return [];
  return [media, ...asArray((media as any).groups)];
}

function isType(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.toLowerCase().startsWith(prefix);
}

/** Tracking pixels, which must never become a row's hero image. */
const PIXEL_HOSTS =
  /(feedburner|feedpress|feedsportal|pixel|stats?\.wordpress|doubleclick|scorecardresearch|gravatar\.com\/avatar\/[0-9a-f]{32}\?.*s=1\b)/i;

/**
 * The first usable `<img>` in a body of HTML — the last resort of the
 * fallback chain. Skips 1x1 declarations, known counter hosts, and data
 * URIs, which would otherwise inline a whole image into the SSR payload.
 */
export function firstImageUrl(
  html: string | null | undefined,
  base: string,
): string | undefined {
  if (!html) return undefined;

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src || src.startsWith('data:')) continue;

    const width = Number(/\bwidth\s*=\s*["']?(\d+)/i.exec(tag)?.[1]);
    const height = Number(/\bheight\s*=\s*["']?(\d+)/i.exec(tag)?.[1]);
    if (width === 1 || height === 1) continue;

    const resolved = absolute(decodeEntities(src), base);
    if (!resolved || PIXEL_HOSTS.test(resolved)) continue;
    return resolved;
  }
  return undefined;
}

/**
 * What normalize.ts has already untangled, which the last links of the
 * fallback chain need. Passed in rather than re-derived: the link and the
 * body have format-specific shapes.
 */
export interface MediaContext {
  /** The feed URL — the base for resolving relative image paths. */
  base: string;
  /** The item's own link, already resolved. */
  url?: string;
  summary?: string;
  content?: string;
}

export function extractMedia(item: any, context: MediaContext): ItemMedia {
  const { base } = context;
  const result: ItemMedia = { hasVideo: false, hasAudio: false };

  // Media RSS: thumbnails, then contents.
  for (const source of mediaSources(item?.media)) {
    result.imageUrl ??= bestThumbnail(source?.thumbnails, base);

    for (const content of asArray(source?.contents)) {
      const medium =
        typeof content?.medium === 'string' ? content.medium.toLowerCase() : '';
      if (medium === 'video' || isType(content?.type, 'video/')) {
        result.hasVideo = true;
      }
      if (medium === 'audio' || isType(content?.type, 'audio/')) {
        result.hasAudio = true;
      }
      result.durationSeconds ??= parseDuration(content?.duration);

      if (medium === 'image' || isType(content?.type, 'image/')) {
        result.imageUrl ??= absolute(content?.url, base);
      }
    }

    if (source?.player?.url) result.hasVideo = true;
  }

  // RSS enclosures and JSON Feed attachments.
  for (const attachment of [
    ...asArray(item?.enclosures),
    ...asArray(item?.attachments),
  ]) {
    const type = attachment?.type ?? attachment?.mime_type;
    if (isType(type, 'video/')) result.hasVideo = true;
    if (isType(type, 'audio/')) {
      result.hasAudio = true;
      result.durationSeconds ??= parseDuration(
        attachment?.duration_in_seconds ?? attachment?.duration,
      );
    }
    if (isType(type, 'image/')) {
      result.imageUrl ??= absolute(attachment?.url, base);
    }
  }

  // iTunes, then JSON Feed's own image fields.
  result.durationSeconds ??= parseDuration(item?.itunes?.duration);
  result.imageUrl ??= absolute(item?.itunes?.image, base);
  result.imageUrl ??= absolute(item?.image, base);
  result.imageUrl ??= absolute(item?.banner_image, base);

  // YouTube, from the link alone: no media namespace, no API key, and the
  // backlog stays reclassifiable with an UPDATE.
  const videoId = youtubeVideoId(context.url);
  if (videoId) {
    result.hasVideo = true;
    result.imageUrl ??= youtubeThumbnailUrl(videoId);
  }

  result.imageUrl ??= firstImageUrl(context.content, base);
  result.imageUrl ??= firstImageUrl(context.summary, base);

  return result;
}
