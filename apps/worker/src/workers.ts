import { db } from '@repo/db';
import {
  autoArchiveForAllUsers,
  captureException,
  createDomainContext,
  enqueueStaleFeeds,
  markFeedAsFailing,
  QUEUE_NAMES,
  recordFeedSyncFailure,
  redisConnection,
  syncSingleFeed,
  updateFeedMetadata,
  withTransaction,
  writeFeedSyncLog,
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
      const { feedId, userId } = job.data;
      const ctx = createDomainContext(db, userId);
      // Throws FeedSyncError on failure — BullMQ retries with exponential backoff.
      // The `completed` and `failed` events below are responsible for writing feed_sync_logs.
      return await syncSingleFeed(ctx, feedId);
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

  // Write a feed_sync_logs row on successful completion.
  worker.on('completed', async (job: Job<FeedSyncJobData>, result) => {
    const { feedId } = job.data;
    const durationMs =
      job.processedOn != null ? (job.finishedOn ?? Date.now()) - job.processedOn : null;
    try {
      const ctx = createDomainContext(db, job.data.userId);
      await writeFeedSyncLog(ctx, feedId, result, durationMs);
    } catch (logErr) {
      const err = logErr instanceof Error ? logErr : new Error(String(logErr));
      console.error('Failed to write sync log on completion', { error: err, feedId });
      captureException(err, {
        source: 'worker',
        operation: 'write_sync_log_completed',
        feedId,
      });
    }
  });

  // `failed` fires on every failed attempt.
  // - If retries remain: mark feed as 'failing' and write a feed_sync_logs row.
  // - If all retries exhausted: mark feed as 'broken' and write a feed_sync_logs row.
  worker.on('failed', async (job: Job<FeedSyncJobData> | undefined, err: Error) => {
    if (!job) return;
    const { feedId } = job.data;
    const attemptNumber = job.attemptsMade; // incremented by BullMQ after failure, so already 1-indexed
    const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const durationMs =
      job.processedOn != null ? (job.finishedOn ?? Date.now()) - job.processedOn : null;
    try {
      const { userId } = job.data;
      if (attemptsExhausted) {
        await withTransaction(db, userId, (ctx) =>
          recordFeedSyncFailure(ctx, feedId, err, attemptNumber, durationMs),
        );
      } else {
        await withTransaction(db, userId, (ctx) =>
          markFeedAsFailing(ctx, feedId, err, attemptNumber, durationMs),
        );
      }
    } catch (updateErr) {
      const err = updateErr instanceof Error ? updateErr : new Error(String(updateErr));
      console.error('Failed to record feed sync failure', { error: err, feedId });
      captureException(err, {
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
      const ctx = createDomainContext(db, userId);
      await updateFeedMetadata(ctx, feedId);
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
