import { posthog } from './config';
import { env } from './env';

export interface LogMetadata {
  // Known metadata fields
  sessionId?: string;
  userId?: string;
  source?: 'api' | 'worker';
  // API-specific context
  path?: string;
  method?: string;
  url?: string;
  // Worker-specific context
  jobName?: string;
  // Allow any additional properties
  [key: string]: any;
}

export const logger = {
  error(error: Error, metadata?: LogMetadata) {
    console.error(error);

    if (posthog) {
      const { sessionId, userId, ...rest } = metadata || {};
      posthog.captureException(error, userId || 'unknown', {
        ...rest,
        $session_id: sessionId,
        app: env.POSTHOG_APP,
      });
    }
  },
};
