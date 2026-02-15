import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // Worker concurrency settings (conservative defaults for small VMs)
    WORKER_CONCURRENCY_ORCHESTRATOR: z.coerce.number().default(1),
    WORKER_CONCURRENCY_FEED_SYNC: z.coerce.number().default(2),
    WORKER_CONCURRENCY_FEED_DETAILS: z.coerce.number().default(1),
    WORKER_CONCURRENCY_AUTO_ARCHIVE: z.coerce.number().default(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
