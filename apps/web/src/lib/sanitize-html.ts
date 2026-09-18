// A conservative scrubber for third-party feed HTML.
//
// READ THIS BEFORE TRUSTING IT. This is NOT a complete HTML sanitiser. It is
// a deliberate, minimal defence chosen over two worse options: rendering feed
// HTML untouched, and pulling in a sanitiser dependency before the project
// has agreed to one (CLAUDE.md: ask before adding anything load-bearing).
//
// What it removes:
//   * <script>, <style>, <iframe>, <object>, <embed>, <form> and their content
//   * every on* event-handler attribute
//   * javascript:/vbscript:/data: URLs in href and src
//
// What a real sanitiser does that this does not: parse the document rather
// than pattern-match it, which is what defeats mutation-XSS, malformed-markup
// tricks, and namespace confusion. Regex-based scrubbing is known to be
// defeatable by a determined attacker.
//
// The article body is the one place in the app that renders remote markup, so
// this is the boundary to harden with a parser-based sanitiser (DOMPurify or
// equivalent) BEFORE multi-user lands — at that point one user's malicious
// feed could otherwise reach another user's session.

/** Elements whose content is executable, presentational-hijacking, or both. */
const DANGEROUS_ELEMENTS =
  /<(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** The same elements in self-closing or unclosed form. */
const DANGEROUS_VOID =
  /<(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*\/?>/gi;

/** onclick=, onerror=, onload= … in quoted or bare form. */
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Script-bearing URL schemes in any attribute that navigates or loads. */
const DANGEROUS_URLS =
  /\s+(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data)\s*:[^"]*"|'\s*(?:javascript|vbscript|data)\s*:[^']*'|(?:javascript|vbscript|data)\s*:[^\s>]*)/gi;

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(DANGEROUS_ELEMENTS, '')
    .replace(DANGEROUS_VOID, '')
    .replace(EVENT_HANDLERS, '')
    .replace(DANGEROUS_URLS, '');
}
