// Short vertical video, as pure functions. Isomorphic and importing nothing:
// sync classifies items with it on the server, the viewer builds embed URLs
// with it in the browser.
//
// Detection is the regex below and nothing else, because a YouTube channel
// feed already distinguishes the two by link shape:
//
//   .../shorts/5mU6SRS2Bxo     vs     .../watch?v=Qtl8lJwbd4g
//
// So it costs no request and no API key, and the stored `articles.url` makes
// reclassifying the backlog an UPDATE. docs/shorts.md has the alternatives.
//
// The wider question — video, podcast, note, article — is article-kind.ts,
// which builds on the id reader below rather than rematching these URLs.

/**
 * Ids are 11 chars of URL-safe base64. Anchored at the path so a link that
 * merely mentions /shorts/ in a query string cannot match, and tolerant of
 * the host prefix (`m.`, `www.`, bare) that mobile shares use.
 */
const YOUTUBE_SHORT = /^https?:\/\/(?:[\w-]+\.)*youtube\.com\/shorts\/([\w-]{11})/i;

/** The video id when this URL is a YouTube Short, else null. */
export function youtubeShortId(url: string | null | undefined): string | null {
  if (!url) return null;
  return YOUTUBE_SHORT.exec(url)?.[1] ?? null;
}

/**
 * `youtube-nocookie.com` is the same player on a domain that sets no
 * tracking cookies before playback. `rel=0` keeps end-card recommendations
 * inside the channel. `autoplay=1` is safe because the iframe is only ever
 * created from a click.
 */
export function shortEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
}

/**
 * `hqdefault` exists for every video where `maxresdefault` 404s. For a Short
 * it holds the vertical frame pillarboxed into 480x360, so callers crop with
 * `object-cover` rather than showing the bars.
 */
export function shortThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
