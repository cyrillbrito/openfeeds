import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_URL: z.string().default('http://localhost:3000'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
