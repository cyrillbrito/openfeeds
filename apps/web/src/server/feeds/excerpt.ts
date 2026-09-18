// Turning feed HTML into the one or two lines a list row shows.
//
// This runs ONCE, at sync time, and the result is stored. The list used to do
// it per render, on the client, which meant `listArticles` had to select the
// full `summary` blob for fifty rows and serialise all of it into the SSR
// payload just to throw 95% of it away in the browser.
//
// The three things that make a derived excerpt better than a `slice(0, 220)`:
// entities are decoded rather than shown raw, publisher boilerplate is
// dropped before it eats the budget, and the cut lands on a sentence.
import 'server-only';

/** How long an excerpt may be before it gets cut. */
const LIMIT = 200;

/**
 * A cut is only allowed to prefer a sentence boundary if that boundary is at
 * least this far in. Without a floor, a body opening with "Hi." would produce
 * a three-character excerpt and look like a bug.
 */
const MIN_SENTENCE_RATIO = 0.45;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  deg: '°',
  eacute: 'é',
  egrave: 'è',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  szlig: 'ß',
  ccedil: 'ç',
  ntilde: 'ñ',
};

/**
 * Decode entities in ONE pass.
 *
 * The obvious implementation — a chain of `.replace()` calls — is wrong, and
 * wrong in a way that only shows up on text about markup: replacing `&amp;`
 * before `&lt;` turns the literal `&amp;lt;` into `<`. A single pass over the
 * entity pattern cannot double-decode, so the ordering question disappears.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    const token = body.toLowerCase();
    if (token.startsWith('#x')) {
      const code = Number.parseInt(token.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (token.startsWith('#')) {
      const code = Number.parseInt(token.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[token] ?? match;
  });
}

/**
 * HTML to plain text.
 *
 * Script and style bodies are removed rather than stripped of their tags —
 * otherwise a feed that inlines CSS contributes a paragraph of selectors.
 * Block-level closers become spaces so that `<p>One</p><p>Two</p>` does not
 * read as "OneTwo".
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Publisher furniture, removed from the END of the text.
 *
 * All of these are appended by the platform rather than written by the
 * author, and all of them are pure cost in a two-line preview. Anchored at
 * the end on purpose: "read more about the read more problem" is a real
 * sentence and must survive.
 */
const BOILERPLATE = [
  /\s*The post .{0,200}? appeared first on .{0,120}?\.?\s*$/i,
  /\s*This post .{0,200}? appeared first on .{0,120}?\.?\s*$/i,
  /\s*Originally published (at|on) .{0,120}?\.?\s*$/i,
  /\s*Continue reading\s*[….]*\s*(→|»|>>)?\s*$/i,
  /\s*Read (more|the rest)( of this entry)?\s*[….]*\s*(→|»|>>)?\s*$/i,
  /\s*Share this:?\s*$/i,
  /\s*Related posts?:?\s*$/i,
  /\s*\[\s*…\s*\]\s*$/,
  /\s*(→|»|>>)\s*$/,
];

export function stripBoilerplate(text: string): string {
  let result = text;
  // Looped because publishers stack them — "Continue reading →" directly
  // after "The post X appeared first on Y." is the common WordPress tail.
  for (let pass = 0; pass < BOILERPLATE.length; pass += 1) {
    const before = result;
    for (const pattern of BOILERPLATE) result = result.replace(pattern, '');
    result = result.trim();
    if (result === before.trim()) break;
  }
  return result;
}

/**
 * Cut to length on the friendliest boundary available.
 *
 * Sentence first, word second, hard cut never — `slice()` alone is what
 * produces "in the order I hit th…".
 */
export function truncate(text: string, limit = LIMIT): string {
  if (text.length <= limit) return text;

  const window = text.slice(0, limit);

  // The LAST sentence terminator that is followed by whitespace (or ends the
  // window). Requiring the whitespace is what stops a version number or a
  // decimal from reading as the end of a sentence.
  let sentenceEnd = -1;
  for (const match of window.matchAll(/[.!?…](?=\s|$)/g)) {
    sentenceEnd = match.index + 1;
  }
  if (sentenceEnd >= limit * MIN_SENTENCE_RATIO) {
    return window.slice(0, sentenceEnd).trim();
  }

  const lastSpace = window.lastIndexOf(' ');
  const cut = lastSpace > limit * MIN_SENTENCE_RATIO ? window.slice(0, lastSpace) : window;
  return `${cut.replace(/[\s,;:—–-]+$/, '')}…`;
}

/**
 * Whether a body is nothing but links.
 *
 * Hacker News is the canonical case: its entire <description> is
 * `<a href="...">Comments</a>`, which reduces to the single word "Comments"
 * and then sits under every row in the list saying nothing. Aggregators and
 * link-only feeds all share the shape.
 *
 * Detected structurally rather than by blocklisting the word: remove every
 * anchor's text and see whether anything is left. A real summary that merely
 * ENDS in a link keeps its prose and survives, which a word-count heuristic
 * would not manage.
 */
export function isLinkOnly(html: string | null | undefined): boolean {
  if (!html) return false;
  const withoutAnchors = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ');
  return htmlToText(html).length > 0 && htmlToText(withoutAnchors).length === 0;
}

/**
 * The excerpt for one item.
 *
 * Falls through summary → content, which is the case the old list missed
 * entirely: a feed that ships an empty `<description>` and the real body in
 * `content:encoded` used to show no preview at all.
 *
 * Returns undefined rather than an empty string so the column stays NULL and
 * "no excerpt" is distinguishable from "excerpt not derived yet".
 */
export function deriveExcerpt(
  summary: string | null | undefined,
  content: string | null | undefined,
  limit = LIMIT,
): string | undefined {
  for (const source of [summary, content]) {
    if (isLinkOnly(source)) continue;
    const text = stripBoilerplate(htmlToText(source));
    if (text.length > 0) return truncate(text, limit);
  }
  return undefined;
}

/**
 * The first real image in a body of HTML — the last resort of the image
 * fallback chain, for feeds with no media namespace and no enclosure.
 *
 * "Real" is doing work here. Feed HTML is full of tracking pixels, and one of
 * them as the hero image is a visible bug rather than a missing feature, so
 * anything declaring itself 1x1 and anything from a known counter host is
 * skipped. Data URIs are skipped too: inlining one into a list row would put
 * the whole image in the SSR payload.
 */
const PIXEL_HOSTS =
  /(feedburner|feedpress|feedsportal|pixel|stats?\.wordpress|doubleclick|scorecardresearch|gravatar\.com\/avatar\/[0-9a-f]{32}\?.*s=1\b)/i;

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

    const resolved = resolveUrl(decodeEntities(src), base);
    if (!resolved || PIXEL_HOSTS.test(resolved)) continue;
    return resolved;
  }
  return undefined;
}

function resolveUrl(url: string, base: string): string | undefined {
  try {
    return new URL(url, base).href;
  } catch {
    return undefined;
  }
}
