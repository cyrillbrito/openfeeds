import { posthog } from './config';
import { env } from './env';
import { getAppVersion } from './version';

export interface ExceptionMetadata {
  sessionId?: string;
  userId?: string;
  [key: string]: any;
}

/** Walk the error cause chain and return all causes as an array of serializable objects. */
function serializeCauseChain(
  error: Error,
): Array<{ message: string; name: string; stack?: string }> {
  const chain: Array<{ message: string; name: string; stack?: string }> = [];
  let current: unknown = error.cause;
  let depth = 0;
  while (current instanceof Error && depth < 10) {
    chain.push({ name: current.name, message: current.message, stack: current.stack });
    current = current.cause;
    depth++;
  }
  return chain;
}

/** Report an exception to PostHog error tracking. Only use for unexpected errors (bugs, infra failures). */
export function captureException(error: Error, metadata?: ExceptionMetadata) {
  if (!posthog) return;

  const { sessionId, userId, ...rest } = metadata || {};
  const causeChain = serializeCauseChain(error);

  posthog.captureException(error, userId || 'unknown', {
    ...rest,
    $session_id: sessionId,
    app: env.POSTHOG_APP,
    app_version: getAppVersion(),
    ...(causeChain.length > 0 && { error_cause_chain: causeChain }),
  });
}
