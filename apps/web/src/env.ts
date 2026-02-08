import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/*
  Avoid using VITE_ variables since these are set at built time.
  Not very useful since we want to build the image once, and deploy in many envs.
*/

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    ELECTRIC_URL: z.string().default('http://localhost:3060'), // Electric SQL sync service (use electric:3000 in Docker)
    ELECTRIC_SOURCE_ID: z.string().optional(),
    ELECTRIC_SOURCE_SECRET: z.string().optional(),
    DATA_PATH: z.string().optional(), // Local file storage for audio, etc.
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    POSTHOG_PUBLIC_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    // TTS (Unreal Speech)
    UNREAL_SPEECH_API_KEY: z.string().optional(),
    TTS_DEFAULT_VOICE: z.string().default('Scarlett'),
    // Auth
    BETTER_AUTH_SECRET: z.string(),
    SIMPLE_AUTH: z.stringbool().default(false),
    CLIENT_DOMAIN: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues, null, 2)}`);
  },
});
