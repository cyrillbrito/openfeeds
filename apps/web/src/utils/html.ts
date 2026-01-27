export function containsHtml(text: string): boolean {
  return /<[^>]+>/.test(text);
}

export function sanitizeHtml(html: string): string {
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');
  return sanitized;
}

export function downshiftHeadings(html: string, levels: number = 3): string {
  return html.replace(/<(\/?)h([1-6])([^>]*)>/gi, (_match, closing, level, attrs) => {
    const currentLevel = parseInt(level, 10);
    const newLevel = Math.min(6, currentLevel + levels);
    return `<${closing}h${newLevel}${attrs}>`;
  });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Removes anchor tags but keeps their text content.
 * Useful for card previews where we don't want clickable links.
 */
export function stripAnchors(html: string): string {
  return html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');
}

export function truncateHtml(html: string, maxLength: number): string {
  const stripped = stripHtml(html);
  if (stripped.length <= maxLength) {
    return html;
  }
  return stripped.substring(0, maxLength) + '...';
}
