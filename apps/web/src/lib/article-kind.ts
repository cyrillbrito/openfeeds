// What an entry IS, as opposed to which feed it came from.
//
// This is the column the article list branches on: a video row shows a 16:9
// thumbnail and no description, a note shows its whole body and no title, a
// podcast puts square art on the left. Getting it wrong is visible, so the
// rules below are deliberately conservative — an item only leaves 'article'
// on evidence, never on a guess.
//
// Isomorphic and importing nothing but URL helpers: sync classifies incoming
// items with it on the server, and the list reads the stored result.
import { youtubeShortId } from './shorts';
import { youtubeVideoId } from './youtube';

/**
 * Stored in `articles.kind`.
 *
 * A Drizzle text enum is types-only — SQLite stores plain text with no CHECK
 * constraint — so this list has grown from `'article' | 'short'` without a
 * migration, and can grow again the same way.
 */
export type ArticleKind = 'article' | 'short' | 'video' | 'podcast' | 'note';

/**
 * What the classifier gets to look at.
 *
 * Everything here is already in hand when normalize.ts builds an item, so
 * classification costs no extra parse and no request. `hasVideo` / `hasAudio`
 * come from the Media RSS and enclosure extraction in server/feeds/media.ts.
 */
export interface KindSignals {
  url?: string;
  /** A media:content or enclosure whose type says video. */
  hasVideo?: boolean;
  /** A media:content or enclosure whose type says audio. */
  hasAudio?: boolean;
  /**
   * The title the FEED supplied, before normalize.ts substitutes 'Untitled'.
   * Its absence is the signal — see below.
   */
  feedTitle?: string;
}

/**
 * Classify one item.
 *
 * Order matters. Shorts are checked before video because a Short is a video
 * and already has its own screen; audio is checked after video because a
 * video enclosure alongside an audio one is a video with a soundtrack, not a
 * podcast.
 *
 * `note` is decided by the ABSENCE OF A TITLE, and nothing else. The tempting
 * rule — "the body is shorter than the excerpt limit" — was rejected: plenty
 * of ordinary articles ship a one-line <description>, and rendering those as
 * bodyless notes looks broken in a way a missed note never does. Mastodon,
 * tumblr asides and most microblogs genuinely omit the title, so the precise
 * signal is also the sufficient one.
 */
export function classifyItem(signals: KindSignals): ArticleKind {
  if (youtubeShortId(signals.url)) return 'short';
  if (signals.hasVideo || youtubeVideoId(signals.url)) return 'video';
  if (signals.hasAudio) return 'podcast';
  if (!signals.feedTitle?.trim()) return 'note';
  return 'article';
}

/** Kinds whose rows render no text preview at all. */
const EXCERPTLESS = new Set<ArticleKind>(['video', 'short']);

/**
 * Whether a kind's row shows a text preview.
 *
 * Video is the case that motivated this: YouTube's media:description is the
 * entire description box — sponsor copy, timestamp lists, link dumps — and
 * 200 characters of that is strictly worse than showing nothing.
 *
 * A note is NOT excerptless, despite having no title to sit under. Its
 * excerpt IS its body: the row renders it where every other kind renders a
 * title, which is the whole point of the kind. Suppressing it would leave the
 * row showing the word 'Untitled' and nothing else.
 */
export function showsExcerpt(kind: ArticleKind): boolean {
  return !EXCERPTLESS.has(kind);
}

/**
 * A note's body is the row's primary text, so it gets a longer budget than a
 * preview that sits under a title.
 */
export function excerptLimitFor(kind: ArticleKind): number | undefined {
  return kind === 'note' ? 400 : undefined;
}
