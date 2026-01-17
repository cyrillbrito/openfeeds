import { INVALID_EXTENSIONS_REGEX, INVALID_URL_PATTERNS } from './constants.js';

export function parseUrl(urlString: string): URL {
  return new URL(urlString);
}

export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  if (relativeUrl.startsWith('//')) {
    const base = new URL(baseUrl);
    return base.protocol + relativeUrl;
  }

  if (relativeUrl.startsWith('/')) {
    const base = new URL(baseUrl);
    return base.origin + relativeUrl;
  }

  if (/^(http|https):\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }

  if (!relativeUrl.includes('/')) {
    const base = new URL(baseUrl);
    const pathWithoutFile = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return base.origin + pathWithoutFile + relativeUrl;
  }

  return new URL(relativeUrl, baseUrl).toString();
}

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

export function truncate(fullStr: string, strLen: number, separator = '...'): string {
  if (fullStr.length <= strLen) return fullStr;

  const sepLen = separator.length;

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

export function normalizeUrl(url: string, baseUrl?: string): string {
  let normalizedUrl = url
    .replace(/^(feed:\/\/)/, 'https://')
    .replace(/^(feed:)/, '')
    .replace(/^(http:\/\/)/, 'https://');

  if (baseUrl && !normalizedUrl.startsWith('http')) {
    normalizedUrl = resolveUrl(baseUrl, normalizedUrl);
  }

  return normalizedUrl;
}

export function shouldSkipUrl(url: string): boolean {
  if (INVALID_URL_PATTERNS.some((pattern) => url.includes(pattern))) {
    return true;
  }

  if (INVALID_EXTENSIONS_REGEX.test(url)) {
    return true;
  }

  return false;
}

export function isValidFeedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

export function dedupeFeeds<T extends { url: string }>(feeds: T[]): T[] {
  return feeds.filter((feed, index, array) => array.findIndex((f) => f.url === feed.url) === index);
}
