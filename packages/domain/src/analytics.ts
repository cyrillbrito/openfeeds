import { getPosthog } from './config';

/**
 * Server-side analytics event definitions.
 *
 * Naming convention: `category:object_action`
 * - category: context (feeds, tags, articles, audio, filters, auth)
 * - object: noun (feed, tag, article, rule, opml)
 * - action: present-tense verb (create, delete, update, import, generate)
 *
 * Property naming:
 * - snake_case: `feed_id`, `article_count`
 * - is_/has_ prefix for booleans: `is_bulk`, `has_content`
 * - _at suffix for timestamps: `created_at`
 */
export interface ServerAnalyticsEventMap {
  // Authentication
  'auth:account_create': {
    method: 'email';
  };
  'auth:session_create': {
    method: 'email';
  };

  // Feed Management
  'feeds:subscription_create': {
    feed_id: string;
    feed_url: string;
    source: 'manual' | 'opml' | 'discovery';
  };
  'feeds:subscription_delete': {
    feed_id: string;
  };
  'feeds:opml_import': {
    feed_count: number;
    tag_count: number;
    failed_count: number;
  };

  // Tag Management
  'tags:label_create': {
    tag_id: string;
    color: string;
  };
  'tags:label_delete': {
    tag_id: string;
  };

  // Filter Rules
  'filters:rule_create': {
    feed_id: string;
    operator: string;
  };

  // Audio/TTS
  'tts:audio_generate': {
    article_id: string;
    duration_ms?: number;
  };

  // Background job events
  'jobs:feed_sync': {
    feed_id: string;
    article_count: number;
    new_article_count: number;
  };
  'jobs:feed_sync_fail': {
    feed_id: string;
    error: string;
  };
  'jobs:auto_archive': {
    count: number;
  };
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
  const posthog = getPosthog();
  if (posthog) {
    posthog.capture({
      distinctId: userId,
      event,
      properties,
    });
  }
}

/**
 * Track a server-side analytics event without requiring a user ID.
 * Use sparingly - only for system-level events not tied to a specific user.
 *
 * @param event - Event name
 * @param properties - Event properties
 */
export function trackSystemEvent(event: string, properties?: Record<string, unknown>): void {
  const posthog = getPosthog();
  if (posthog) {
    posthog.capture({
      distinctId: 'system',
      event,
      properties,
    });
  }
}
