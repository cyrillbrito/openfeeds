/**
 * Parse a URL and return URL object
 */
export function parseUrl(urlString: string): URL {
  return new URL(urlString);
}

/**
 * Resolve relative URLs to absolute URLs
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  // If feed's url starts with "//"
  if (relativeUrl.startsWith('//')) {
    const base = new URL(baseUrl);
    return base.protocol + relativeUrl;
  }

  // If feed's url starts with "/"
  if (relativeUrl.startsWith('/')) {
    const base = new URL(baseUrl);
    return base.origin + relativeUrl;
  }

  // If feed's url starts with http or https
  if (/^(http|https):\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }

  // If feed's has no slash - relative to current path
  if (!relativeUrl.includes('/')) {
    const base = new URL(baseUrl);
    const pathWithoutFile = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return base.origin + pathWithoutFile + relativeUrl;
  }

  // Default case - relative to base
  return new URL(relativeUrl, baseUrl).toString();
}

/**
 * Check if a URL protocol is supported for RSS discovery
 */
export function isSupportedProtocol(url: string): boolean {
  const unsupportedProtocols = [
    'chrome:',
    'chrome-extension:',
    'about:',
    'vivaldi:',
    'edge:',
    'chrome-devtools:',
    'devtools:',
  ];

  try {
    const parsed = new URL(url);
    return !unsupportedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Truncate string in the middle with separator
 */
export function truncate(fullStr: string, strLen: number, separator = '...'): string {
  if (fullStr.length <= strLen) return fullStr;

  const sepLen = separator.length;

  // If separator is longer than or equal to the target length, just return the separator or original string
  if (sepLen >= strLen) {
    return fullStr.length <= strLen ? fullStr : separator.substring(0, strLen);
  }

  const charsToShow = strLen - sepLen;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return (
    fullStr.substring(0, frontChars) + separator + fullStr.substring(fullStr.length - backChars)
  );
}
