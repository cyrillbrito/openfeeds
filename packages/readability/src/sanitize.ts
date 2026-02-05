import sanitize from 'sanitize-html';

/**
 * Sanitizes HTML for safe storage and rendering.
 * Uses sanitize-html defaults which remove scripts, iframes, styles, etc.
 *
 * Called at ingestion time (RSS sync) to ensure all stored content is safe.
 */
export function sanitizeHtml(html: string | null | undefined): string | null | undefined {
  return html ? sanitize(html) : html;
}
