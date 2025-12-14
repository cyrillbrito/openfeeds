import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ElysiaAdapter } from '@bull-board/elysia';
import {
  autoArchiveQueue,
  feedDetailQueue,
  feedSyncOrchestratorQueue,
  singleFeedSyncQueue,
} from '@repo/domain';

/**
 * Setup Bull Board dashboard for monitoring BullMQ queues.
 * This provides a UI at /admin/queues to view job status.
 *
 * Note: This only provides monitoring - it does NOT create Worker instances.
 * Workers are created in the worker app (apps/worker).
 */
export function setupBullBoard() {
  const serverAdapter = new ElysiaAdapter('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(feedSyncOrchestratorQueue),
      new BullMQAdapter(singleFeedSyncQueue),
      new BullMQAdapter(feedDetailQueue),
      new BullMQAdapter(autoArchiveQueue),
    ],
    serverAdapter,
    options: {
      // This configuration fixes a build error on Bun caused by eval (https://github.com/oven-sh/bun/issues/5809#issuecomment-2065310008)
      uiBasePath: 'node_modules/@bull-board/ui',
    },
  });

  return serverAdapter;
}
