// YouTube URL knowledge that is not specific to Shorts.
//
// Shorts got here first (src/lib/shorts.ts) because they needed their own
// screen. Ordinary videos need less: no player, no vertical stage — just the
// two things the article list wants, which are "is this a video" and "what
// does its thumbnail look like".
//
// The valuable part is that both answers come from the URL we already store
// in `articles.url`. No API key, no oEmbed request, no media namespace to
// parse — which also means the whole backlog can be reclassified with an
// UPDATE rather than a re-fetch of every feed.
import { shortThumbnailUrl, youtubeShortId } from './shorts';

/**
 * Every URL shape a YouTube video arrives in.
 *
 * `/watch?v=` is the canonical one and what channel feeds emit; `youtu.be/`
 * is the share link; `/embed/` and `/live/` turn up in feeds that syndicate
 * players rather than pages. Ids are 11 characters of URL-safe base64.
 */
const WATCH = /^https?:\/\/(?:[\w-]+\.)*youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i;
const SHARE = /^https?:\/\/(?:[\w-]+\.)*youtu\.be\/([\w-]{11})/i;
const EMBED = /^https?:\/\/(?:[\w-]+\.)*youtube(?:-nocookie)?\.com\/(?:embed|live|v)\/([\w-]{11})/i;

/**
 * The video id for any YouTube link, Shorts included.
 *
 * Shorts are delegated rather than re-matched: `shorts.ts` owns that pattern,
 * and two regexes answering the same question is exactly how the two drift.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  return (
    WATCH.exec(url)?.[1] ??
    SHARE.exec(url)?.[1] ??
    EMBED.exec(url)?.[1] ??
    youtubeShortId(url)
  );
}

/**
 * The poster frame for any video id.
 *
 * Identical to `shortThumbnailUrl` — `hqdefault` is the one size that exists
 * for every video, where `maxresdefault` 404s on anything never uploaded at
 * that resolution. Re-exported under the general name rather than copied.
 */
export const youtubeThumbnailUrl = shortThumbnailUrl;
