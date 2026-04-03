import { FetchError } from '@electric-sql/client';
import { posthog } from 'posthog-js';
import { toastService } from '~/lib/toast-service';

/**
 * Extracts a user-friendly message from an error.
 *
 * The server-side error boundary (packages/domain/src/error-boundary.ts) already
 * replaces infrastructure errors with a generic UnexpectedError before they reach
 * the client. This function is a defense-in-depth safety net — it caps message
 * length and catches anything that slips through.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong';

  const msg = error.message;

  if (msg.length > 150) {
    return `${msg.slice(0, 150)}…`;
  }

  return msg;
}

const MAX_SHAPE_RETRIES = 2;

/**
 * Wraps a collection mutation handler with error handling.
 * Catches errors, shows a toast, reports to PostHog, then re-throws so TanStack DB rolls back optimistic state.
 * Passes through the return value from the wrapped function (e.g., `{ txid }` for Electric sync).
 */
export function collectionErrorHandler<TArgs extends unknown[], TReturn>(
  context: string,
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (error) {
      const message = sanitizeErrorMessage(error);
      toastService.error(message);
      posthog.captureException(error, { context });
      throw error;
    }
  };
}

/**
 * Returns an Electric shape stream error handler.
 *
 * Return value controls retry behavior (per Electric SQL docs):
 * - `{}` → retry with same params
 * - `void` / `undefined` → stop syncing permanently
 *
 * Behavior:
 * - 401 Unauthorized → stop immediately and redirect to login (session expired)
 * - Other errors → retry up to MAX_SHAPE_RETRIES times, then stop
 */
export function shapeErrorHandler(
  context: string,
): (error: unknown) => Record<string, never> | void {
  let hasToasted = false;
  let retryCount = 0;

  return (error: unknown) => {
    const message = sanitizeErrorMessage(error);
    posthog.captureException(error, { context });

    // 401 = session expired — stop retrying and redirect to login
    if (error instanceof FetchError && error.status === 401) {
      posthog.capture('auth:session_fail', {
        source: 'shape_error_handler',
        context,
        status: 401,
        path: window.location.pathname,
      });

      if (!hasToasted) {
        toastService.error('Session expired. Redirecting to login…');
        hasToasted = true;
      }

      window.location.href = '/login';
      return; // stop syncing
    }

    if (!hasToasted) {
      toastService.error(message);
      hasToasted = true;
    }

    // Retry other errors a limited number of times
    if (retryCount < MAX_SHAPE_RETRIES) {
      retryCount++;
      posthog.capture('sync:shape_fail', {
        context,
        retry_count: retryCount,
        max_retries: MAX_SHAPE_RETRIES,
        message,
      });
      return {};
    }

    // Exhausted retries — stop syncing
    posthog.capture('sync:shape_fail', {
      context,
      retry_count: retryCount,
      max_retries: MAX_SHAPE_RETRIES,
      exhausted: true,
      message,
    });
    return;
  };
}
