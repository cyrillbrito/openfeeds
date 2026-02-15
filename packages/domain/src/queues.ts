import { Queue } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from './config';

export interface UserFeedJobData {
  userId: string;
  feedId: string;
}

let _feedSyncOrchestratorQueue: Queue | null = null;
export function getFeedSyncOrchestratorQueue(): Queue {
  return (_feedSyncOrchestratorQueue ??= new Queue(QUEUE_NAMES.FEED_SYNC_ORCHESTRATOR, {
    connection: redisConnection,
  }));
}

let _singleFeedSyncQueue: Queue<UserFeedJobData> | null = null;
export function getSingleFeedSyncQueue(): Queue<UserFeedJobData> {
  return (_singleFeedSyncQueue ??= new Queue<UserFeedJobData>(QUEUE_NAMES.SINGLE_FEED_SYNC, {
    connection: redisConnection,
  }));
}

let _feedDetailQueue: Queue<UserFeedJobData> | null = null;
export function getFeedDetailQueue(): Queue<UserFeedJobData> {
  return (_feedDetailQueue ??= new Queue<UserFeedJobData>(QUEUE_NAMES.FEED_DETAIL, {
    connection: redisConnection,
  }));
}

let _autoArchiveQueue: Queue | null = null;
export function getAutoArchiveQueue(): Queue {
  return (_autoArchiveQueue ??= new Queue(QUEUE_NAMES.AUTO_ARCHIVE, {
    connection: redisConnection,
  }));
}

let _queuesInitialized = false;

/**
 * Enqueue a single feed sync job
 */
export async function enqueueFeedSync(userId: string, feedId: string) {
  return getSingleFeedSyncQueue().add(
    `${userId}-${feedId}`,
    {
      userId,
      feedId,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

/**
 * Enqueue a feed detail/metadata update job
 */
export async function enqueueFeedDetail(userId: string, feedId: string) {
  return getFeedDetailQueue().add(
    `${userId}-${feedId}`,
    {
      userId,
      feedId,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

/**
 * Initialize scheduled jobs (orchestrator and auto-archive)
 * Should be called once at startup
 */
export async function initializeScheduledJobs() {
  if (_queuesInitialized) {
    return;
  }

  // Orchestrate feed sync every minute
  await getFeedSyncOrchestratorQueue().upsertJobScheduler(
    'feed-sync-orchestrator',
    {
      pattern: '* * * * *', // Every minute
    },
    {
      opts: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    },
  );

  // Auto-archive daily at midnight
  await getAutoArchiveQueue().upsertJobScheduler(
    'auto-archive',
    {
      pattern: '0 0 * * *', // Daily at midnight (00:00)
    },
    {
      opts: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    },
  );

  _queuesInitialized = true;
}
