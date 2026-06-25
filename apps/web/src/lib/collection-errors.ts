import { FetchError } from '@electric-sql/client';
import { posthog } from 'posthog-js';
import { toastService } from '~/lib/toast-service';

/**
 * Default timeout we ask Electric to wait for a txid to appear in the stream
 * before considering the mutation un-synced. The library default is 5s, which
 * is unrealistically tight when Electric's auto-retry backoff kicks in on 5xx
 * (backoff windows can exceed 30s). Hitting this timeout throws
 * `TimeoutWaitingForTxIdError`, which TanStack DB treats as a failed mutation
 * and rolls back the optimistic state — exactly the "archive bounces back"
 * symptom we tracked down in May 2026. Override per-handler if a specific
 * mutation needs something different.
 *
 * See docs/records/010-mutation-rollback-on-electric-5xx.md.
 */
export const AWAIT_TXID_TIMEOUT_MS = 30_000;

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
 * Shape of the value returned by Electric-aware mutation handlers.
 * `{ txid }` is consumed by `@tanstack/electric-db-collection` which calls
 * `awaitTxId(txid, timeout)` internally before resolving the optimistic state.
 */
type ElectricHandlerResult = { txid: number | number[]; timeout?: number } | undefined | void;

/**
 * Wraps a collection mutation handler with:
 *  - Error handling: catches errors, shows a toast, reports to PostHog,
 *    re-throws so TanStack DB rolls back optimistic state.
 *  - Default `awaitTxId` timeout: forwards `{ txid, timeout }` so we wait
 *    long enough for Electric's auto-retry backoff to recover.
 */
export function collectionErrorHandler<TArgs extends unknown[]>(
  context: string,
  fn: (...args: TArgs) => Promise<ElectricHandlerResult>,
): (...args: TArgs) => Promise<ElectricHandlerResult> {
  return async (...args: TArgs) => {
    try {
      const result = await fn(...args);

      // Always set a generous default timeout so `awaitTxId` doesn't blow up
      // on transient Electric backoff windows. Handlers can override by
      // returning `{ txid, timeout: <ms> }` explicitly — we preserve that.
      if (
        result &&
        typeof result === 'object' &&
        'txid' in result &&
        result.timeout === undefined
      ) {
        return { ...result, timeout: AWAIT_TXID_TIMEOUT_MS };
      }
      return result;
    } catch (error) {
      const message = sanitizeErrorMessage(error);
      const errorName = error instanceof Error ? error.name : typeof error;
      toastService.error(message);
      // Tag with errorName so `TimeoutWaitingForTxIdError` (server committed
      // but txid never reached the stream — see record 010) is distinguishable
      // in PostHog from other mutation failures.
      posthog.captureException(error, { context, errorName });
      throw error;
    }
  };
}

/**
 * Returns an Electric shape stream error handler.
 *
 * Per Electric docs (https://electric-sql.com/docs/api/clients/typescript):
 *   - 5xx errors and network errors are AUTOMATICALLY retried with exponential
 *     backoff by Electric itself. This `onError` is invoked AFTER those
 *     auto-retries are exhausted.
 *   - For 4xx errors, returning `{}` retries with same params; returning void
 *     stops syncing permanently.
 *
 * Behavior:
 *   - 401 Unauthorized → stop syncing and redirect to login (session expired)
 *   - Other errors → log + toast, but keep retrying. Stopping permanently
 *     leaves the user with a stale UI that only a page refresh can fix —
 *     better to retry indefinitely with backoff and let Electric/network
 *     recover than to silently give up.
 */
export function shapeErrorHandler(
  context: string,
): (error: unknown) => Record<string, never> | void {
  let hasToasted = false;

  return (error: unknown) => {
    const message = sanitizeErrorMessage(error);
    const status = error instanceof FetchError ? error.status : undefined;

    // 401 = session expired — expected behavior, not a bug; skip exception reporting
    if (status === 401) {
      if (!hasToasted) {
        toastService.error('Session expired. Redirecting to login…');
        hasToasted = true;
      }

      window.location.href = '/login';
      return undefined; // stop syncing
    }

    posthog.captureException(error, { context, status });

    if (!hasToasted) {
      toastService.error(message);
      hasToasted = true;
    }

    // Keep retrying for all other errors. Electric's own client adds exponential
    // backoff for 5xx/network, so this doesn't hammer the server.
    return {};
  };
}
