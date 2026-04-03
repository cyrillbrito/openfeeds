/**
 * Candidate feed discovered from a URL.
 * This is intentionally separate from persisted domain feed entities.
 */
export interface DiscoveredFeed {
  /** The URL of the RSS/Atom feed */
  url: string;
  /** Human-readable title of the feed */
  title: string;
  /** MIME type of the feed (e.g., 'application/rss+xml') */
  type?: string;
  /** Feed description when available */
  description?: string;
  /** Site URL from the feed metadata */
  siteUrl?: string;
  /** Best-effort icon URL */
  icon?: string;
}

/**
 * Result from service-specific feed detection
 */
export interface ServiceResult {
  /** Whether the service matched the provided URL */
  match: boolean;
  /** Array of discovered feeds for this service */
  feeds: DiscoveredFeed[];
}

/**
 * Backward-compatible alias. Prefer DiscoveredFeed in new code.
 */
export type Feed = DiscoveredFeed;

/**
 * Options for feed discovery
 */
export interface DiscoveryOptions {
  /** Timeout for HTTP requests in milliseconds */
  timeout?: number;
  /** Whether to follow redirects */
  followRedirects?: boolean;
  /** Custom User-Agent header */
  userAgent?: string;
  /** Maximum concurrent candidate verification requests */
  verificationConcurrency?: number;
  /** Limit candidate set size before verification */
  maxCandidates?: number;
}

/**
 * Options for extracting feeds from a document
 */
export interface ExtractOptions {
  /** Base URL for resolving relative URLs */
  baseUrl: string;
}
