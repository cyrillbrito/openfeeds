import type { ConnectionOptions } from 'bullmq';
import { PostHog } from 'posthog-node';
import { env } from './env';

/** Redis connection options for BullMQ. */
export const redisConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
};

/** PostHog client instance, or null if not configured. */
export const posthog: PostHog | null = env.POSTHOG_PUBLIC_KEY
  ? new PostHog(env.POSTHOG_PUBLIC_KEY, {
      host: 'https://eu.i.posthog.com',
      enableExceptionAutocapture: true,
    })
  : null;

/** Flush pending PostHog events. Call on process exit. */
export async function shutdownDomain(): Promise<void> {
  if (posthog) {
    await posthog.shutdown();
  }
}

export const QUEUE_NAMES = {
  FEED_SYNC_ORCHESTRATOR: 'feed-sync-orchestrator',
  SINGLE_FEED_SYNC: 'single-feed-sync',
  FEED_DETAIL: 'feed-detail',
  AUTO_ARCHIVE: 'auto-archive',
} as const;
