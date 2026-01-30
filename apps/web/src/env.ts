import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    ELECTRIC_URL: z.string().default('http://localhost:3060'), // Electric SQL sync service (use electric:3000 in Docker)
    DATA_PATH: z.string().optional(), // Local file storage for audio, etc.
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
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
});
