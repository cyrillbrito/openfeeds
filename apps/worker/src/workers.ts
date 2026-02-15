import { db } from '@repo/db';
import {
  autoArchiveArticles,
  logger,
  QUEUE_NAMES,
  redisConnection,
  updateFeedMetadata,
} from '@repo/domain';
import { attemptAsync } from '@repo/shared/utils';
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
      const [usersError, users] = await attemptAsync(
        db.query.user.findMany({ columns: { id: true } }),
      );

      if (usersError) {
        logger.error(usersError, {
          source: 'worker',
          jobName: job.queueName,
        });
        throw usersError;
      }

      for (const user of users) {
        const [syncError] = await attemptAsync(syncOldestFeeds(user.id));

        if (syncError) {
          logger.error(syncError, {
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
      const [syncError] = await attemptAsync(syncSingleFeed(userId, feedId));

      if (syncError) {
        logger.error(syncError, {
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
      const [updateError] = await attemptAsync(updateFeedMetadata(userId, feedId));

      if (updateError) {
        logger.error(updateError, {
          source: 'worker',
          jobName: job.queueName,
          userId,
          operation: 'feed_details_worker',
          feedId,
        });
        throw updateError;
      }
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
      const [usersError, users] = await attemptAsync(
        db.query.user.findMany({ columns: { id: true } }),
      );

      if (usersError) {
        logger.error(usersError, {
          source: 'worker',
          jobName: job.queueName,
        });
        throw usersError;
      }

      for (const user of users) {
        const [archiveError] = await attemptAsync(autoArchiveArticles(user.id));

        if (archiveError) {
          logger.error(archiveError, {
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
