/**
 * Normalizes user input into a valid URL for feed discovery.
 *
 * - Trims whitespace
 * - Prepends `https://` when no http(s) protocol is present
 * - Validates the result is a parseable URL
 *
 * Returns the normalized URL string, or `null` if the input can't be turned into a valid URL.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return null;
  }
}
