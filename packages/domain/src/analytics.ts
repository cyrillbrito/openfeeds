import { posthog } from './config';

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
    method: 'email' | 'google' | 'apple';
  };
  'auth:session_create': {
    method: 'email' | 'google' | 'apple';
  };

  // Feed Management
  'feeds:feed_create': {
    feed_id: string;
    feed_url: string;
    source: 'manual';
  };
  'feeds:feed_delete': {
    feed_id: string;
  };
  'feeds:opml_import': {
    feed_count: number;
    tag_count: number;
    failed_count: number;
  };

  // Tag Management
  'tags:tag_create': {
    tag_id: string;
    color: string;
  };
  'tags:tag_delete': {
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
      properties,
    });
  }
}
