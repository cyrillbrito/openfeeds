import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/*
  Avoid using VITE_ variables since these are set at built time.
  Not very useful since we want to build the image once, and deploy in many envs.
*/

export const env = createEnv({
  server: {
    // Electric SQL sync service
    ELECTRIC_URL: z.string().default('http://localhost:3060'),
    ELECTRIC_SOURCE_ID: z.string().optional(),
    ELECTRIC_SOURCE_SECRET: z.string().optional(),
    // PostHog (exposed to client via public-config server function)
    POSTHOG_PUBLIC_KEY: z.string().optional(),
    // Auth
    BETTER_AUTH_SECRET: z.string(),
    SIMPLE_AUTH: z.stringbool().default(false),
    TRUSTED_ORIGINS: z
      .string()
      .transform((val) => val.split(',').map((s) => s.trim()))
      .pipe(z.array(z.url())),
    BASE_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues, null, 2)}`);
  },
});
