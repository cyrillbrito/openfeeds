import { db } from '@repo/db';
import {
  autoArchiveArticles,
  logger,
  QUEUE_NAMES,
  redisConnection,
  updateFeedMetadata,
} from '@repo/domain';
import { Worker, type Job } from 'bullmq';
import { env } from './env';
import { syncOldestFeeds, syncSingleFeed } from './rss-sync';

export interface UserFeedJobData {
  userId: string;
  feedId: string;
}

export function createFeedSyncOrchestratorWorker() {
  return new Worker(
    QUEUE_NAMES.FEED_SYNC_ORCHESTRATOR,
    async (job) => {
      console.log(`Starting feed sync orchestrator job ${job.id}`);
      const users = await db.query.user.findMany({ columns: { id: true } });

      for (const user of users) {
        try {
          await syncOldestFeeds(user.id);
        } catch (err) {
          logger.error(err instanceof Error ? err : new Error(String(err)), {
            source: 'worker',
            jobName: job.queueName,
            userId: user.id,
          });
          continue;
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_ORCHESTRATOR,
    },
  );
}

export function createSingleFeedSyncWorker() {
  return new Worker<UserFeedJobData>(
    QUEUE_NAMES.SINGLE_FEED_SYNC,
    async (job) => {
      console.log(
        `Starting single feed sync job ${job.id} for user ${job.data.userId}, feed ${job.data.feedId}`,
      );
      const { userId, feedId } = job.data;

      // Feed sync errors are handled internally (tracked in DB as sync_status/sync_error).
      // We don't re-throw because a broken feed is an expected scenario, not a worker failure.
      try {
        await syncSingleFeed(userId, feedId);
      } catch (err) {
        logger.error(err instanceof Error ? err : new Error(String(err)), {
          source: 'worker',
          jobName: job.queueName,
          userId,
          operation: 'single_feed_sync_worker',
          feedId,
        });
      }
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_FEED_SYNC,
    },
  );
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
      const users = await db.query.user.findMany({ columns: { id: true } });

      for (const user of users) {
        try {
          await autoArchiveArticles(user.id);
        } catch (err) {
          logger.error(err instanceof Error ? err : new Error(String(err)), {
            source: 'worker',
            jobName: job.queueName,
            userId: user.id,
          });
          continue;
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY_AUTO_ARCHIVE,
    },
  );
}
