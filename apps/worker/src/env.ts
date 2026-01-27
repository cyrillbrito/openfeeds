import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DB_PATH: z.string().default('../../dbs'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    POSTHOG_PUBLIC_KEY: z
      .string()
      .optional()
      .default('phc_V6I0xn1Ptmx3QVqXzLNAK22H6D58kR3SJTYg1JdVEx'),
    RESEND_API_KEY: z.string().optional(),
    // Worker concurrency settings (conservative defaults for small VMs)
    WORKER_CONCURRENCY_ORCHESTRATOR: z.coerce.number().default(1),
    WORKER_CONCURRENCY_FEED_SYNC: z.coerce.number().default(2),
    WORKER_CONCURRENCY_FEED_DETAILS: z.coerce.number().default(1),
    WORKER_CONCURRENCY_AUTO_ARCHIVE: z.coerce.number().default(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
