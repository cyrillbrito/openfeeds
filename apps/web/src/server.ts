import { initDb } from '@repo/db';
import { initDomain } from '@repo/domain';
import handler, { createServerEntry } from '@tanstack/solid-start/server-entry';
import { env } from './env';

// Initialize packages with config from environment
// Note: initDb must be called before initDomain
initDb({ databaseUrl: env.DATABASE_URL });

initDomain({
  dataPath: env.DATA_PATH,
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  posthogKey: env.POSTHOG_PUBLIC_KEY,
  posthogApp: 'server',
  resendApiKey: env.RESEND_API_KEY,
  unrealSpeechApiKey: env.UNREAL_SPEECH_API_KEY,
  ttsDefaultVoice: env.TTS_DEFAULT_VOICE,
});

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
