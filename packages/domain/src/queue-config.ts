import type { ConnectionOptions } from 'bullmq';
import { environment } from './environment';

export const redisConnection: ConnectionOptions = {
  host: environment.redisHost,
  port: environment.redisPort,
};

export const QUEUE_NAMES = {
  FEED_SYNC_ORCHESTRATOR: 'feed-sync-orchestrator',
  SINGLE_FEED_SYNC: 'single-feed-sync',
  FEED_DETAIL: 'feed-detail',
  AUTO_ARCHIVE: 'auto-archive',
} as const;
