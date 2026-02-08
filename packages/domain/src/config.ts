import type { ConnectionOptions } from 'bullmq';
import { PostHog } from 'posthog-node';

/**
 * Configuration required to initialize the domain package.
 * Apps must call `initDomain()` with this config before using domain functions.
 *
 * Note: Database configuration is handled separately via `initDb()` from @repo/db.
 * Apps should call `initDb()` before `initDomain()`.
 */
export interface DomainConfig {
  /** Path for local file storage (audio files, etc.) */
  dataPath?: string;
  redis: {
    host: string;
    port: number;
  };
  /** PostHog API key. When set, errors are reported to PostHog. */
  posthogKey?: string;
  /** Label attached to every PostHog event to identify the source app (e.g. 'server', 'worker') */
  posthogApp?: string;
  resendApiKey?: string;
  unrealSpeechApiKey?: string;
  ttsDefaultVoice?: string;
}

// Internal state - populated by initDomain()
let _config: DomainConfig | null = null;
let _posthog: PostHog | null = null;

/**
 * Initialize the domain package with configuration.
 * Must be called once at app startup before using any domain functions.
 *
 * Note: Call `initDb()` from @repo/db before calling this function.
 */
export function initDomain(config: DomainConfig): void {
  _config = config;

  if (config.posthogKey) {
    _posthog = new PostHog(config.posthogKey, {
      host: 'https://eu.i.posthog.com',
      enableExceptionAutocapture: true,
    });
  }
}

/**
 * Get the domain configuration. Throws if not initialized.
 */
export function getConfig(): DomainConfig {
  if (!_config) {
    throw new Error('Domain not initialized. Call initDomain() first.');
  }
  return _config;
}

/** Get the PostHog client, or null if not configured. */
export function getPosthog(): PostHog | null {
  return _posthog;
}

/** Flush pending PostHog events. Call on process exit. */
export async function shutdownDomain(): Promise<void> {
  if (_posthog) {
    await _posthog.shutdown();
  }
}

/**
 * Get Redis connection options for BullMQ.
 */
export function getRedisConnection(): ConnectionOptions {
  const config = getConfig();
  return {
    host: config.redis.host,
    port: config.redis.port,
  };
}

export const QUEUE_NAMES = {
  FEED_SYNC_ORCHESTRATOR: 'feed-sync-orchestrator',
  SINGLE_FEED_SYNC: 'single-feed-sync',
  FEED_DETAIL: 'feed-detail',
  AUTO_ARCHIVE: 'auto-archive',
} as const;
