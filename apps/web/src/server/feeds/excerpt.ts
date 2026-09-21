// Feed HTML to the one or two lines a list row shows. Runs once at sync
// time and the result is stored, so `summary` never reaches the client.
//
// What a derived excerpt gets over `slice(0, 200)`: entities are decoded,
// publisher boilerplate is dropped before it eats the budget, and the cut
// lands on a sentence.
import 'server-only';

const LIMIT = 200;

/**
 * A sentence boundary is only preferred when it is at least this far in.
 * Without the floor, a body opening with "Hi." yields a 3-char excerpt.
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
 * Decode entities in ONE pass. A chain of `.replace()` calls double-decodes:
 * replacing `&amp;` before `&lt;` turns the literal `&amp;lt;` into `<`.
 */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    (match, body: string) => {
      const token = body.toLowerCase();
      if (token.startsWith('#x')) {
        const code = Number.parseInt(token.slice(2), 16);
        return Number.isFinite(code) && code > 0
          ? String.fromCodePoint(code)
          : match;
      }
      if (token.startsWith('#')) {
        const code = Number.parseInt(token.slice(1), 10);
        return Number.isFinite(code) && code > 0
          ? String.fromCodePoint(code)
          : match;
      }
      return NAMED_ENTITIES[token] ?? match;
    },
  );
}

/**
 * HTML to plain text. Script and style bodies are removed wholesale so an
 * inlined stylesheet does not contribute a paragraph of selectors; block
 * closers become spaces so `<p>One</p><p>Two</p>` is not "OneTwo".
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
 * Publisher furniture, anchored at the END so that "read more about the read
 * more problem" survives as the real sentence it is.
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

/** Looped because publishers stack them, WordPress most of all. */
export function stripBoilerplate(text: string): string {
  let result = text;
  for (let pass = 0; pass < BOILERPLATE.length; pass += 1) {
    const before = result;
    for (const pattern of BOILERPLATE) result = result.replace(pattern, '');
    result = result.trim();
    if (result === before.trim()) break;
  }
  return result;
}

/** Cut on a sentence, else on a word, never mid-word. */
export function truncate(text: string, limit = LIMIT): string {
  if (text.length <= limit) return text;

  const window = text.slice(0, limit);

  // The last terminator followed by whitespace — requiring the whitespace is
  // what stops a version number or a decimal reading as a sentence end.
  let sentenceEnd = -1;
  for (const match of window.matchAll(/[.!?…](?=\s|$)/g)) {
    sentenceEnd = match.index + 1;
  }
  if (sentenceEnd >= limit * MIN_SENTENCE_RATIO) {
    return window.slice(0, sentenceEnd).trim();
  }

  const lastSpace = window.lastIndexOf(' ');
  const cut =
    lastSpace > limit * MIN_SENTENCE_RATIO ? window.slice(0, lastSpace) : window;
  return `${cut.replace(/[\s,;:—–-]+$/, '')}…`;
}

/**
 * Whether a body is nothing but links — Hacker News ships a `<description>`
 * of just `<a>Comments</a>`. Detected structurally rather than by
 * blocklisting the word, so a summary that merely ends in a link survives.
 */
export function isLinkOnly(html: string | null | undefined): boolean {
  if (!html) return false;
  const withoutAnchors = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ');
  return htmlToText(html).length > 0 && htmlToText(withoutAnchors).length === 0;
}

/**
 * The excerpt for one item. Falls through summary → content, so a feed that
 * ships an empty `<description>` and the body in `content:encoded` still
 * gets a preview.
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
