export const RSS_MIME_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss',
  'application/atom',
  'application/rdf',
  'text/rss+xml',
  'text/atom+xml',
  'text/rdf+xml',
  'text/rss',
  'text/atom',
  'text/rdf',
  'application/json',
  'application/feed+json',
  'text/json',
] as const;

export const COMMON_FEED_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
  '/index.xml',
  '/index.rss',
  '/index.atom',
  '/index.json',
  '/feed.json',
  '/rss/news.xml',
  '/articles/feed',
  '/rss/index.html',
  '/blog/feed/',
  '/blog/rss/',
  '/blog/rss.xml',
  '/feed/posts/default',
  '/feeds/default',
  '/feed/default',
  '/data/rss',
  '/?feed=rss',
  '/?feed=atom',
  '/?feed=rss2',
  '/?feed=rdf',
  '/?format=feed',
  '/rss/featured',
] as const;

export const INVALID_URL_PATTERNS = [
  'wp-includes',
  'wp-json',
  'xmlrpc',
  'wp-admin',
  '/amp/',
  'mailto:',
  '//fonts.',
  '//font.',
] as const;

export const INVALID_EXTENSIONS_REGEX =
  /\.(jpe?g|png|gif|bmp|mp4|mp3|mkv|css|js|pdf|woff2?|svg|ttf|zip)$/i;

export const DEFAULT_DISCOVERY_OPTIONS = {
  timeout: 10000,
  followRedirects: true,
  userAgent: 'RSS-Discovery-Bot/1.0',
} as const;
