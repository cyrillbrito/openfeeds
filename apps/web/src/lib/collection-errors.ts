import posthog from 'posthog-js';
import { toastService } from '~/lib/toast-service';

/** Extracts a user-friendly message from an error, hiding raw SQL/technical details. */
function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong';

  const msg = error.message;
  const msgLower = msg.toLowerCase();

  // Hide raw SQL statements — show generic sync error instead
  if (
    msgLower.includes('insert into') ||
    msgLower.includes('update ') ||
    msgLower.includes('delete from') ||
    msgLower.includes('select ') ||
    msgLower.includes('values (')
  ) {
    return 'Something went wrong while syncing. Please try again.';
  }

  // Cap message length for anything else that slips through
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
 */
export function shapeErrorHandler(context: string): (error: unknown) => void {
  return (error: unknown) => {
    const message = sanitizeErrorMessage(error);
    toastService.error(message);
    posthog.captureException(error, { context });
  };
}
