import posthog from 'posthog-js';
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
 * Shows an error toast and reports to PostHog but does NOT throw — stream errors are informational.
 * Returns {} to signal the stream should retry (returning void would stop it permanently).
 */
export function shapeErrorHandler(context: string): (error: unknown) => Record<string, never> {
  let hasToasted = false;
  return (error: unknown) => {
    const message = sanitizeErrorMessage(error);
    if (!hasToasted) {
      toastService.error(message);
      hasToasted = true;
    }
    posthog.captureException(error, { context });
    return {};
  };
}
