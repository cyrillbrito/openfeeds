// Images, durations and enclosures — the half of every feed item that
// normalize.ts used to drop on the floor.
//
// None of this needs a new dependency or a request: feedsmith already parses
// the Media RSS namespace, the iTunes namespace, RSS enclosures and JSON Feed
// attachments. It just hands them back in each format's own shape, which is
// what this module flattens.
//
// The shapes, for reference (verified against node_modules/feedsmith):
//   item.media.groups[].thumbnails[]  {url, width, height}   <- YouTube lives here
//   item.media.thumbnails[]           {url, width, height}
//   item.media.contents[]             {url, type, medium, duration, width, height}
//   item.enclosures[]                 {url, type, length}
//   item.itunes                       {image, duration}
//   JSON Feed: item.image, item.banner_image, item.attachments[]
import 'server-only';

import { youtubeThumbnailUrl, youtubeVideoId } from '../../lib/youtube';
import { firstImageUrl } from './excerpt';

export interface ItemMedia {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Seconds. Rendered as the duration badge on video and podcast rows. */
  durationSeconds?: number;
  /** The audio file, when there is one. What a play button would need. */
  enclosureUrl?: string;
  /** Classification signals — see lib/article-kind.ts. */
  hasVideo: boolean;
  hasAudio: boolean;
}

interface Thumbnail {
  url?: string;
  width?: number;
  height?: number;
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

/**
 * iTunes durations come as seconds, `mm:ss` or `hh:mm:ss` — the spec allows
 * all three and publishers use all three.
 */
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
 * The best thumbnail out of a Media RSS list.
 *
 * Largest wins, because feeds that offer several offer them smallest-first
 * as often as not, and a 120px thumbnail stretched into a 16:9 hero looks
 * worse than anything else on the screen. Entries with no dimensions sort
 * last rather than being discarded — YouTube declares its size, plenty of
 * others do not.
 */
function bestThumbnail(thumbnails: unknown, base: string): Thumbnail | undefined {
  let best: Thumbnail | undefined;

  for (const thumbnail of asArray(thumbnails)) {
    const url = absolute(thumbnail?.url, base);
    if (!url) continue;

    const width = positive(thumbnail?.width);
    // `?? 0` puts undeclared sizes last without discarding them: YouTube
    // declares its dimensions, plenty of other feeds never do.
    if (!best || (width ?? 0) > (best.width ?? 0)) {
      best = { url, width, height: positive(thumbnail?.height) };
    }
  }

  return best;
}

/** Media RSS hangs the same elements off the item and off each group. */
function mediaSources(media: unknown): any[] {
  if (!media || typeof media !== 'object') return [];
  return [media, ...asArray((media as any).groups)];
}

function isType(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.toLowerCase().startsWith(prefix);
}

/**
 * What normalize.ts has already worked out about the item, which the last two
 * links of the fallback chain need.
 *
 * Passed in rather than re-derived: the link and the body have format-specific
 * shapes (Atom's `links[]` versus RSS's `<link>`, `content:encoded` versus
 * `content_html`) and untangling those is normalize.ts's whole job.
 */
export interface MediaContext {
  /** The feed URL — the base for resolving relative image paths. */
  base: string;
  /** The item's own link, already resolved. */
  url?: string;
  summary?: string;
  content?: string;
}

/** Everything the article list needs from one parsed item. */
export function extractMedia(item: any, context: MediaContext): ItemMedia {
  const { base } = context;
  const result: ItemMedia = { hasVideo: false, hasAudio: false };

  // --- Media RSS: thumbnails, then contents --------------------------
  for (const source of mediaSources(item?.media)) {
    const thumbnail = bestThumbnail(source?.thumbnails, base);
    if (thumbnail && !result.imageUrl) {
      result.imageUrl = thumbnail.url;
      result.imageWidth = thumbnail.width;
      result.imageHeight = thumbnail.height;
    }

    for (const content of asArray(source?.contents)) {
      const medium = typeof content?.medium === 'string' ? content.medium.toLowerCase() : '';
      if (medium === 'video' || isType(content?.type, 'video/')) result.hasVideo = true;
      if (medium === 'audio' || isType(content?.type, 'audio/')) {
        result.hasAudio = true;
        result.enclosureUrl ??= absolute(content?.url, base);
      }
      result.durationSeconds ??= parseDuration(content?.duration);

      if (!result.imageUrl && (medium === 'image' || isType(content?.type, 'image/'))) {
        result.imageUrl = absolute(content?.url, base);
        result.imageWidth = positive(content?.width);
        result.imageHeight = positive(content?.height);
      }
    }

    if (!result.hasVideo && source?.player?.url) result.hasVideo = true;
  }

  // --- RSS enclosures and JSON Feed attachments ----------------------
  for (const attachment of [
    ...asArray(item?.enclosures),
    ...asArray(item?.attachments),
  ]) {
    const type = attachment?.type ?? attachment?.mime_type;
    if (isType(type, 'video/')) result.hasVideo = true;
    if (isType(type, 'audio/')) {
      result.hasAudio = true;
      result.enclosureUrl ??= absolute(attachment?.url, base);
      result.durationSeconds ??= parseDuration(
        attachment?.duration_in_seconds ?? attachment?.duration,
      );
    }
    if (!result.imageUrl && isType(type, 'image/')) {
      result.imageUrl = absolute(attachment?.url, base);
    }
  }

  // --- iTunes, then JSON Feed's own image fields ---------------------
  result.durationSeconds ??= parseDuration(item?.itunes?.duration);
  result.imageUrl ??= absolute(item?.itunes?.image, base);
  if (item?.itunes) result.hasAudio ||= Boolean(result.enclosureUrl);

  result.imageUrl ??= absolute(item?.image, base);
  result.imageUrl ??= absolute(item?.banner_image, base);

  // --- YouTube, from the link alone ----------------------------------
  // No media namespace needed: the id in the URL is enough for both the
  // poster frame and the "this is a video" signal. Channel feeds DO carry
  // media:group, but plenty of things that syndicate YouTube do not.
  const videoId = youtubeVideoId(context.url);
  if (videoId) {
    result.hasVideo = true;
    result.imageUrl ??= youtubeThumbnailUrl(videoId);
  }

  // --- Last resort: an <img> in the body -----------------------------
  result.imageUrl ??= firstImageUrl(context.content, base);
  result.imageUrl ??= firstImageUrl(context.summary, base);

  return result;
}
