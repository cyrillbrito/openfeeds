import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_PORT: z.coerce.number().default(3001),
    BASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string(),
    SIMPLE_AUTH: z.stringbool().default(false),
    TRUSTED_ORIGINS: z
      .string()
      .transform((val) => val.split(',').map((s) => s.trim()))
      .pipe(z.array(z.url())),
    // Electric SQL
    ELECTRIC_URL: z.string().default('http://localhost:3060'),
    ELECTRIC_SOURCE_ID: z.string().optional(),
    ELECTRIC_SOURCE_SECRET: z.string().optional(),
    // Social providers (optional)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    // AI
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z
      .enum(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'])
      .default('claude-haiku-4-5'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues, null, 2)}`);
  },
});
