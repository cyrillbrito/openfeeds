import {
  autoArchiveArticles,
  dbProvider,
  logger,
  QUEUE_NAMES,
  redisConnection,
  updateFeedMetadata,
} from '@repo/domain';
import { attemptAsync } from '@repo/shared/utils';
import { Worker, type Job } from 'bullmq';
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
      const authDb = dbProvider.authDb();
      const [usersError, users] = await attemptAsync(
        authDb.query.user.findMany({ columns: { id: true } }),
      );

      if (usersError) {
        logger.error(usersError, {
          source: 'worker',
          jobName: job.queueName,
        });
        throw usersError;
      }

      for (const user of users) {
        const db = dbProvider.userDb(user.id);
        const [syncError] = await attemptAsync(syncOldestFeeds(user.id, db));

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
      concurrency: 2,
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

      const db = dbProvider.userDb(userId);
      const [syncError] = await attemptAsync(syncSingleFeed(db, feedId));

      if (syncError) {
        logger.error(syncError, {
          source: 'worker',
          jobName: job.queueName,
          userId,
          operation: 'single_feed_sync_worker',
          feedId,
        });
        throw syncError;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
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
      concurrency: 2,
    },
  );
}

export function createAutoArchiveWorker() {
  return new Worker(
    QUEUE_NAMES.AUTO_ARCHIVE,
    async (job: Job) => {
      console.log(`Starting auto archive job ${job.id}`);
      const authDb = dbProvider.authDb();
      const [usersError, users] = await attemptAsync(
        authDb.query.user.findMany({ columns: { id: true } }),
      );

      if (usersError) {
        logger.error(usersError, {
          source: 'worker',
          jobName: job.queueName,
        });
        throw usersError;
      }

      for (const user of users) {
        const db = dbProvider.userDb(user.id);
        const [archiveError] = await attemptAsync(autoArchiveArticles(db));

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
      concurrency: 2,
    },
  );
}
