import type { ConnectionOptions } from 'bullmq';

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
  posthogPublicKey?: string;
  resendApiKey?: string;
  unrealSpeechApiKey?: string;
  ttsDefaultVoice?: string;
}

// Internal state - populated by initDomain()
let _config: DomainConfig | null = null;

/**
 * Initialize the domain package with configuration.
 * Must be called once at app startup before using any domain functions.
 *
 * Note: Call `initDb()` from @repo/db before calling this function.
 */
export function initDomain(config: DomainConfig): void {
  _config = config;
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
