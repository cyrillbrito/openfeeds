// What an entry IS, as opposed to which feed it came from — the column the
// article list branches on: a video shows a 16:9 thumbnail and no
// description, a note shows its body and no title, a podcast puts square art
// on the left. An item only leaves 'article' on evidence, never a guess.
import { youtubeShortId } from './shorts';
import { youtubeVideoId } from './youtube';

/** Stored in `articles.kind`. Types-only, so the list grows without a migration. */
export type ArticleKind = 'article' | 'short' | 'video' | 'podcast' | 'note';

/** Everything here is already in hand when normalize.ts builds an item. */
export interface KindSignals {
  url?: string;
  /** From the Media RSS / enclosure extraction in server/feeds/media.ts. */
  hasVideo?: boolean;
  hasAudio?: boolean;
  /**
   * The title the FEED supplied, before 'Untitled' is substituted. Its
   * absence is the signal — see below.
   */
  feedTitle?: string;
}

/**
 * Order matters: a Short is a video but has its own screen, and a video
 * enclosure alongside an audio one is a video with a soundtrack.
 *
 * `note` is the absence of a title and nothing else. Mastodon, tumblr asides
 * and most microblogs genuinely omit it; "the body is short" was rejected
 * because plenty of ordinary articles ship a one-line <description>.
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
 * A video shows none: YouTube's media:description is the whole description
 * box — sponsor copy, timestamps, link dumps. A note DOES show one, because
 * its excerpt is its body and renders where other kinds render a title.
 */
export function showsExcerpt(kind: ArticleKind): boolean {
  return !EXCERPTLESS.has(kind);
}

/** A note's excerpt is its primary text, so it gets a longer budget. */
export function excerptLimitFor(kind: ArticleKind): number | undefined {
  return kind === 'note' ? 400 : undefined;
}
