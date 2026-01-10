import { Queue } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from './queue-config';

export interface UserFeedJobData {
  userId: string;
  feedId: string;
}

// Queue instances for enqueueing jobs (domain owns the business logic of when to enqueue)
let queuesInitialized = false;

export const feedSyncOrchestratorQueue = new Queue(QUEUE_NAMES.FEED_SYNC_ORCHESTRATOR, {
  connection: redisConnection,
});

export const singleFeedSyncQueue = new Queue<UserFeedJobData>(QUEUE_NAMES.SINGLE_FEED_SYNC, {
  connection: redisConnection,
});

export const feedDetailQueue = new Queue<UserFeedJobData>(QUEUE_NAMES.FEED_DETAIL, {
  connection: redisConnection,
});

export const autoArchiveQueue = new Queue(QUEUE_NAMES.AUTO_ARCHIVE, {
  connection: redisConnection,
});

/**
 * Enqueue a single feed sync job
 */
export async function enqueueFeedSync(userId: string, feedId: string) {
  return singleFeedSyncQueue.add(
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
  return feedDetailQueue.add(
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
  if (queuesInitialized) {
    return;
  }

  // Orchestrate feed sync every minute
  await feedSyncOrchestratorQueue.upsertJobScheduler(
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
  await autoArchiveQueue.upsertJobScheduler(
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

  queuesInitialized = true;
}
