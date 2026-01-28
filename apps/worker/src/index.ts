import { initDb } from '@repo/db';
import { initDomain, initializeScheduledJobs, logger, QUEUE_NAMES } from '@repo/domain';
import { env } from './env';
import {
  createAutoArchiveWorker,
  createFeedDetailsWorker,
  createFeedSyncOrchestratorWorker,
  createSingleFeedSyncWorker,
} from './workers';

// Initialize packages with config from environment
// Note: initDb must be called before initDomain
initDb({ databaseUrl: env.DATABASE_URL });

initDomain({
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  posthogPublicKey: env.POSTHOG_PUBLIC_KEY,
  resendApiKey: env.RESEND_API_KEY,
});

// Initialize scheduled jobs (orchestrator, auto-archive)
await initializeScheduledJobs();

// Create workers
const feedSyncOrchestratorWorker = createFeedSyncOrchestratorWorker();
const singleFeedSyncWorker = createSingleFeedSyncWorker();
const feedDetailsWorker = createFeedDetailsWorker();
const autoArchiveWorker = createAutoArchiveWorker();

// Setup error handlers
feedSyncOrchestratorWorker.on('failed', (job, err) => {
  logger.error(err, {
    operation: QUEUE_NAMES.FEED_SYNC_ORCHESTRATOR,
    jobId: job?.id,
  });
});

singleFeedSyncWorker.on('failed', (job, err) => {
  logger.error(err, {
    operation: QUEUE_NAMES.SINGLE_FEED_SYNC,
    jobId: job?.id,
    userId: job?.data?.userId,
    feedId: job?.data?.feedId,
  });
});

autoArchiveWorker.on('failed', (job, err) => {
  logger.error(err, {
    operation: QUEUE_NAMES.AUTO_ARCHIVE,
    jobId: job?.id,
  });
});

feedDetailsWorker.on('failed', (job, err) => {
  logger.error(err, {
    operation: QUEUE_NAMES.FEED_DETAIL,
    jobId: job?.id,
  });
});

// Collect all workers for graceful shutdown
const workers = [
  feedSyncOrchestratorWorker,
  singleFeedSyncWorker,
  feedDetailsWorker,
  autoArchiveWorker,
];

// Graceful shutdown handler
async function shutdown() {
  console.log('🛑 Shutting down workers gracefully...');
  try {
    await Promise.all(workers.map((w) => w.close()));
    console.log('✅ All workers closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(error as Error, { operation: 'shutdown' });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Scheduled jobs are initialized by initializeScheduledJobs() above

console.log('🔧 Worker started - BullMQ workers and schedulers initialized');
