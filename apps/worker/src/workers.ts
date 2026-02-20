import {
  autoArchiveForAllUsers,
  enqueueStaleFeeds,
  logger,
  markFeedAsFailing,
  QUEUE_NAMES,
  recordFeedSyncFailure,
  redisConnection,
  syncSingleFeed,
  updateFeedMetadata,
  type FeedSyncJobData,
  type UserFeedJobData,
} from '@repo/domain';
import { Worker, type Job } from 'bullmq';
import { env } from './env';

export function createFeedSyncOrchestratorWorker() {
  return new Worker(
    QUEUE_NAMES.FEED_SYNC_ORCHESTRATOR,
    async (job) => {
      console.log(`Starting feed sync orchestrator job ${job.id}`);
      await enqueueStaleFeeds();
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_ORCHESTRATOR,
    },
  );
}

export function createSingleFeedSyncWorker() {
  const worker = new Worker<FeedSyncJobData>(
    QUEUE_NAMES.SINGLE_FEED_SYNC,
    async (job) => {
      console.log(
        `Starting single feed sync job ${job.id} for feed ${job.data.feedId} (attempt ${job.attemptsMade + 1})`,
      );
      const { feedId } = job.data;
      // Throws on error — BullMQ will retry with exponential backoff (configured on the queue).
      // syncFailCount is only incremented after all attempts are exhausted (see 'failed' event).
      await syncSingleFeed(feedId, job.attemptsMade + 1);
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_FEED_SYNC,

      // Rate limit: max 10 feed sync jobs processed per second across all worker instances.
      // Prevents hammering a single RSS host (e.g. YouTube) with too many concurrent requests.
      // Must match the queue limiter in @repo/domain/queues.ts if one is set.
      limiter: { max: 5, duration: 1000 },
    },
  );

  // `failed` fires on every failed attempt.
  // - If retries remain: mark feed as 'failing' so the UI shows it's having trouble.
  // - If all retries exhausted: mark feed as 'broken' and stop future orchestrator syncs.
  worker.on('failed', async (job: Job<FeedSyncJobData> | undefined, err: Error) => {
    if (!job) return;
    const { feedId } = job.data;
    const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    try {
      if (attemptsExhausted) {
        await recordFeedSyncFailure(feedId, err);
      } else {
        await markFeedAsFailing(feedId);
      }
    } catch (updateErr) {
      logger.error(updateErr instanceof Error ? updateErr : new Error(String(updateErr)), {
        source: 'worker',
        operation: QUEUE_NAMES.SINGLE_FEED_SYNC,
        feedId,
      });
    }
  });

  return worker;
}

export function createFeedDetailsWorker() {
  return new Worker<UserFeedJobData>(
    QUEUE_NAMES.FEED_DETAIL,
    async (job) => {
      console.log(
        `Starting feed details job ${job.id} for user ${job.data.userId}, feed ${job.data.feedId}`,
      );
      const { userId, feedId } = job.data;
      await updateFeedMetadata(userId, feedId);
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_FEED_DETAILS,
    },
  );
}

export function createAutoArchiveWorker() {
  return new Worker(
    QUEUE_NAMES.AUTO_ARCHIVE,
    async (job: Job) => {
      console.log(`Starting auto archive job ${job.id}`);
      await autoArchiveForAllUsers();
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_AUTO_ARCHIVE,
    },
  );
}
