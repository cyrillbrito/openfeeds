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
}
