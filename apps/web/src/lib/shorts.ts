// Everything this app knows about short vertical video, as pure functions.
//
// Isomorphic on purpose, and importing nothing: the sync path classifies
// incoming items with it on the server, and the viewer builds embed URLs with
// it in the browser.
//
// The whole of Shorts detection is the regex below, because YouTube's
// ordinary channel feed already distinguishes the two by LINK SHAPE:
//
//   <link rel="alternate" href="https://www.youtube.com/shorts/5mU6SRS2Bxo"/>
//   <link rel="alternate" href="https://www.youtube.com/watch?v=Qtl8lJwbd4g"/>
//
// So classification costs no network call, no API key and no heuristics — and
// because we already store that link in `articles.url`, reclassifying the
// backlog is an UPDATE rather than a re-fetch. docs/shorts-viewer.md has the
// alternatives (the undocumented UUSH playlist feeds, a HEAD probe against
// /shorts/<id>) and why they lost.
//
// This module answers only "is it a Short". The wider question — video,
// podcast, note, article — lives in src/lib/article-kind.ts, which builds on
// the id reader below rather than matching the same URLs a second time.

/**
 * YouTube video ids are 11 characters of URL-safe base64. Anchored at the
 * path so a link that merely mentions /shorts/ in a query string can't match,
 * and tolerant of the host prefix (`m.`, `www.`, bare) that mobile shares use.
 */
const YOUTUBE_SHORT = /^https?:\/\/(?:[\w-]+\.)*youtube\.com\/shorts\/([\w-]{11})/i;

/** The video id when this URL is a YouTube Short, else null. */
export function youtubeShortId(url: string | null | undefined): string | null {
  if (!url) return null;
  return YOUTUBE_SHORT.exec(url)?.[1] ?? null;
}

/**
 * The player URL.
 *
 * `youtube-nocookie.com` is the same player against a domain that doesn't set
 * tracking cookies until playback starts. `rel=0` keeps the end-card
 * recommendations inside the same channel instead of opening the wider
 * suggestion funnel — the point of this screen is the feeds you subscribed to.
 *
 * `autoplay=1` is honest here: the iframe is only ever created in response to
 * a click, so the gesture that browsers require has already happened.
 */
export function shortEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
}

/**
 * The poster frame.
 *
 * `hqdefault` exists for every video, which `maxresdefault` does not. For a
 * Short it holds the vertical frame pillarboxed into 480x360, so the stage
 * crops it (`object-cover`) rather than showing the black bars.
 */
export function shortThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
