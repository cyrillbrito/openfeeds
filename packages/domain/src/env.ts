import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    POSTHOG_PUBLIC_KEY: z.string().optional(),
    POSTHOG_APP: z.string().default('server'),
    RESEND_API_KEY: z.string().optional(),
    DATA_PATH: z.string().optional(),
    UNREAL_SPEECH_API_KEY: z.string().optional(),
    TTS_DEFAULT_VOICE: z.string().default('Scarlett'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
