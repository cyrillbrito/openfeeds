import { posthog } from './config';
import { getAppVersion } from './version';

/**
 * Server-side analytics event definitions.
 *
 * Naming convention: `category:object_action`
 * - category: context (feeds, tags, articles, audio, filters, auth)
 * - object: noun (feed, tag, article, rule, opml)
 * - action: present-tense verb (create, delete, update, import, generate)
 *
 * Property naming (object_adjective pattern):
 * - snake_case: `feed_url`, `article_count`
 * - is_/has_ prefix for booleans: `is_bulk`, `has_content`
 * - _at suffix for timestamps: `created_at`
 * - No internal IDs — use human-readable values you can filter/group by
 */
export interface ServerAnalyticsEventMap {
  // Authentication
  'auth:account_create': {
    method: 'email' | 'google' | 'apple';
  };
  'auth:session_create': {
    method: 'email' | 'google' | 'apple';
  };

  // Feed Management
  'feeds:feed_create': {
    feed_url: string;
    feed_domain: string;
  };
  'feeds:feed_delete': {
    count: number;
  };
  'feeds:opml_import': {
    feed_count: number;
    tag_count: number;
    failed_count: number;
  };

  // Tag Management
  'tags:tag_create': {
    tag_name: string;
    color: string;
  };
  'tags:tag_delete': {
    count: number;
  };

  // Article Management
  'articles:article_create': {
    article_url: string;
  };

  // Filter Rules
  'filters:rule_create': {
    operator: string;
  };

  // Audio/TTS
  'tts:audio_generate': {
    duration_ms?: number;
  };

  // Limit enforcement
  'limits:feeds_limit_hit': {
    source: 'create' | 'opml_import';
    current_usage: number;
    limit: number;
  };
  'limits:filter_rules_limit_hit': {
    current_usage: number;
    limit: number;
  };
  'limits:saved_articles_limit_hit': {
    current_usage: number;
    limit: number;
  };
  'limits:extractions_limit_hit': {
    window: 'daily' | 'monthly';
    current_usage: number;
    limit: number;
  };
  'limits:tts_limit_hit': {
    window: 'daily' | 'monthly';
    current_usage: number;
    limit: number;
  };
}

/** Extract domain from a URL for analytics (non-identifying). */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Track a server-side analytics event.
 *
 * Use this for CRUD operations and background jobs - more reliable than client-side.
 *
 * @param userId - The user's distinct ID
 * @param event - Event name following `category:object_action` convention
 * @param properties - Event properties (snake_case)
 */
export function trackEvent<T extends keyof ServerAnalyticsEventMap>(
  userId: string,
  event: T,
  properties: ServerAnalyticsEventMap[T],
): void {
  if (posthog) {
    posthog.capture({
      distinctId: userId,
      event,
      properties: {
        ...properties,
        app_version: getAppVersion(),
      },
    });
  }
}
