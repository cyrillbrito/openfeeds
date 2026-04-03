/**
 * Represents a discovered RSS/Atom feed
 */
export interface Feed {
  /** The URL of the RSS/Atom feed */
  url: string;
  /** Human-readable title of the feed */
  title: string;
  /** MIME type of the feed (e.g., 'application/rss+xml') */
  type?: string;
  /** Discovery status after verification */
  status?: 'verified' | 'likely' | 'invalid';
  /** Confidence score from 0 to 1 */
  confidence?: number;
  /** Why this feed was discovered */
  reason?: 'self_feed' | 'known_service' | 'html_alternate' | 'heuristic_link' | 'common_path';
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
  feeds: Feed[];
}

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
  /** Per-candidate verification timeout in milliseconds */
  verificationTimeout?: number;
  /** Limit candidate set size before verification */
  maxCandidates?: number;
  /** Enable in-memory verification cache */
  enableCache?: boolean;
  /** Verification cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Options for extracting feeds from a document
 */
export interface ExtractOptions {
  /** Base URL for resolving relative URLs */
  baseUrl: string;
}
