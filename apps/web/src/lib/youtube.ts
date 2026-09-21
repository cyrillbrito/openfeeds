// YouTube URL knowledge that is not specific to Shorts: "is this a video"
// and "what is its thumbnail", both answered from the stored `articles.url`
// with no API key and no request.
import { shortThumbnailUrl, youtubeShortId } from './shorts';

/**
 * `/watch?v=` is canonical and what channel feeds emit; `youtu.be/` is the
 * share link; `/embed/` and `/live/` turn up in feeds that syndicate players.
 */
const WATCH = /^https?:\/\/(?:[\w-]+\.)*youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i;
const SHARE = /^https?:\/\/(?:[\w-]+\.)*youtu\.be\/([\w-]{11})/i;
const EMBED = /^https?:\/\/(?:[\w-]+\.)*youtube(?:-nocookie)?\.com\/(?:embed|live|v)\/([\w-]{11})/i;

/** Shorts are delegated, not rematched — `shorts.ts` owns that pattern. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  return (
    WATCH.exec(url)?.[1] ??
    SHARE.exec(url)?.[1] ??
    EMBED.exec(url)?.[1] ??
    youtubeShortId(url)
  );
}

/** Same URL for every video id — re-exported under the general name. */
export const youtubeThumbnailUrl = shortThumbnailUrl;
