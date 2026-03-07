import { posthog } from './config';
import { env } from './env';
import { getAppVersion } from './version';

export interface ExceptionMetadata {
  sessionId?: string;
  userId?: string;
  [key: string]: any;
}

/** Report an exception to PostHog error tracking. Only use for unexpected errors (bugs, infra failures). */
export function captureException(error: Error, metadata?: ExceptionMetadata) {
  if (!posthog) return;

  const { sessionId, userId, ...rest } = metadata || {};
  posthog.captureException(error, userId || 'unknown', {
    ...rest,
    $session_id: sessionId,
    app: env.POSTHOG_APP,
    app_version: getAppVersion(),
  });
}
