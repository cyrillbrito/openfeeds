import { Queue } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from './config';
import { captureException } from './error-tracking';

export interface FeedSyncJobData {
  feedId: string;
  userId: string;
}

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

let _singleFeedSyncQueue: Queue<FeedSyncJobData> | null = null;
export function getSingleFeedSyncQueue(): Queue<FeedSyncJobData> {
  return (_singleFeedSyncQueue ??= new Queue<FeedSyncJobData>(QUEUE_NAMES.SINGLE_FEED_SYNC, {
    connection: redisConnection,
    defaultJobOptions: {
      // 10 attempts with exponential backoff (5min base).
      // Spread: ~5m, 10m, 20m, 40m, 80m, 160m, 320m, 640m, 1280m, 2560m ≈ 3 days total.
      // After all attempts are exhausted the worker's `failed` event marks the feed as broken.
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 5 * 60_000,
      },
    },
  }));
}

let _feedDetailQueue: Queue<UserFeedJobData> | null = null;
export function getFeedDetailQueue(): Queue<UserFeedJobData> {
  return (_feedDetailQueue ??= new Queue<UserFeedJobData>(QUEUE_NAMES.FEED_DETAIL, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
    },
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
 * Enqueue a single feed sync job.
 * Uses jobId for deduplication — if a job for this feed is already waiting, delayed
 * (in retry backoff), or active, the new enqueue is silently ignored by BullMQ.
 * This prevents the orchestrator (running every minute) from stacking duplicate jobs.
 *
 * Plain queue operation — callers use `ctx.afterCommit()` to defer when inside a transaction.
 */
export function enqueueFeedSync(userId: string, feedId: string) {
  // TODO(2026-03-14): Remove after confirming no more null userId errors in PostHog
  if (!userId) {
    captureException(
      new Error(`enqueueFeedSync called with null/undefined userId for feed ${feedId}`),
      { source: 'worker', operation: 'enqueue-feed-sync', feedId },
    );
    return Promise.resolve();
  }

  return getSingleFeedSyncQueue().add(
    feedId,
    { feedId, userId },
    {
      // Deduplication key: BullMQ skips adding this job if one with the same jobId
      // is already in waiting, delayed, or active state.
      jobId: `feed-sync-${feedId}`,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

/**
 * Force-enqueue a feed sync, bypassing deduplication.
 * Removes any existing waiting/delayed/active job for this feed first,
 * then adds a fresh job with no delay and attempt count reset to 0.
 * Use this for user-triggered "sync now" or "reset broken feed" actions.
 *
 * Plain queue operation — callers use `ctx.afterCommit()` to defer when inside a transaction.
 */
export async function forceEnqueueFeedSync(userId: string, feedId: string) {
  // TODO(2026-03-14): Remove after confirming no more null userId errors in PostHog
  if (!userId) {
    captureException(
      new Error(`forceEnqueueFeedSync called with null/undefined userId for feed ${feedId}`),
      { source: 'worker', operation: 'force-enqueue-feed-sync', feedId },
    );
    return;
  }

  const queue = getSingleFeedSyncQueue();
  const jobId = `feed-sync-${feedId}`;
  await queue.remove(jobId);
  await queue.add(feedId, { feedId, userId }, { jobId, removeOnComplete: 100, removeOnFail: 500 });
}

/**
 * Enqueue a feed detail/metadata update job.
 *
 * Plain queue operation — callers use `ctx.afterCommit()` to defer when inside a transaction.
 */
export function enqueueFeedDetail(userId: string, feedId: string) {
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
