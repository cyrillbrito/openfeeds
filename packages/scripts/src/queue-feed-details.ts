#!/usr/bin/env bun

/**
 * Script to queue feed detail updates for a specific user
 * Usage: bun queue-feed-details <userId>
 */
import { getUserDb, initDb } from '@repo/db';
import { Queue } from 'bullmq';
import { env } from './env';

interface UserFeedJobData {
  userId: string;
  feedId: number;
}

const QUEUE_NAMES = {
  FEED_DETAIL: 'feed-detail',
} as const;

async function queueFeedDetailsForUser(userId: string) {
  console.log(`Queuing feed detail updates for user: ${userId}`);

  // Initialize database
  initDb({ dbPath: env.DB_PATH });

  // Create queue connection
  const feedDetailQueue = new Queue<UserFeedJobData>(QUEUE_NAMES.FEED_DETAIL, {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    },
  });

  try {
    // Get user's feeds from database
    const db = getUserDb(userId);
    const userFeeds = await db.query.feeds.findMany({
      columns: { id: true, title: true },
    });

    console.log(`Found ${userFeeds.length} feeds for user ${userId}`);

    if (userFeeds.length === 0) {
      console.log('No feeds found for this user');
      return;
    }

    // Queue each feed for detail update
    const jobs = [];
    for (const feed of userFeeds) {
      console.log(`Queuing feed: ${feed.id} - ${feed.title || 'Untitled'}`);
      const job = await feedDetailQueue.add(
        `feed-detail-${userId}-${feed.id}`,
        {
          userId,
          feedId: feed.id,
        },
        {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
      jobs.push(job);
    }

    console.log(`✅ Successfully queued ${jobs.length} feed detail update jobs`);
    console.log('Job IDs:', jobs.map((j) => j.id).join(', '));
  } catch (error) {
    console.error('❌ Error queuing feed details:', error);
    throw error;
  } finally {
    await feedDetailQueue.close();
  }
}

// Parse command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: bun queue-feed-details <userId>');
  process.exit(1);
}

// Run the script
queueFeedDetailsForUser(userId)
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
