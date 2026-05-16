import { FetchError } from '@electric-sql/client';
import type { Collection } from '@tanstack/db';
import { posthog } from 'posthog-js';
import { toastService } from '~/lib/toast-service';

/**
 * Default timeout we ask Electric to wait for a txid to appear in the stream
 * before considering the mutation un-synced. The library default is 5s, which
 * is unrealistically tight when Electric's auto-retry backoff kicks in on 5xx
 * (backoff windows can exceed 30s). Hitting this timeout throws
 * `TimeoutWaitingForTxIdError`, which TanStack DB treats as a failed mutation
 * and rolls back the optimistic state — exactly the "archive bounces back"
 * symptom we're tracking. Override per-handler if a specific mutation needs
 * something different.
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
 * Extra context passed to wrapped handlers as a second argument. Lets the
 * handler thread the mutationId through to the server fn (e.g. as an
 * `x-mutation-id` header) so server-side console logs can be correlated with
 * the client-side `[mutation:*]` logs. Existing handlers that ignore the
 * second argument are unaffected.
 */
export interface MutationHandlerContext {
  mutationId: string;
}

/**
 * Wraps a collection mutation handler with:
 *  - Error handling: catches errors, shows a toast, reports real errors to
 *    PostHog (`captureException`), re-throws so TanStack DB rolls back
 *    optimistic state.
 *  - Console-only lifecycle logging at every stage (`start`, `server_ok`,
 *    `error`/`timeout`) so we can diagnose "did the server commit?" vs
 *    "did the sync confirmation arrive?" vs "did the optimistic state roll
 *    back?" by reading the browser console. Not sent to PostHog — too noisy.
 *  - Default `awaitTxId` timeout: forwards `{ txid, timeout }` so we wait
 *    long enough for Electric's auto-retry backoff to recover.
 */
export function collectionErrorHandler<TArgs extends unknown[]>(
  context: string,
  fn: (args: TArgs[0], ctx: MutationHandlerContext) => Promise<ElectricHandlerResult>,
): (...args: TArgs) => Promise<ElectricHandlerResult> {
  return async (...args: TArgs) => {
    const startedAt = performance.now();
    const mutationId = Math.random().toString(36).slice(2, 10);

    // Try to extract row keys for correlation in logs (works for the
    // `{ transaction }` shape that all Electric mutation handlers use).
    const transaction = (args[0] as { transaction?: { mutations?: Array<{ key: unknown }> } })
      ?.transaction;
    const keys = transaction?.mutations?.map((m) => String(m.key)) ?? [];

    // eslint-disable-next-line no-console
    console.info(`[mutation:start] ${context}`, { mutationId, keys });

    try {
      const result = await fn(args[0], { mutationId });
      const elapsedMs = Math.round(performance.now() - startedAt);

      const txid =
        result && typeof result === 'object' && 'txid' in result ? result.txid : undefined;
      // eslint-disable-next-line no-console
      console.info(`[mutation:server_ok] ${context}`, { mutationId, keys, elapsedMs, txid });

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
      const elapsedMs = Math.round(performance.now() - startedAt);
      const message = sanitizeErrorMessage(error);
      const errorName = error instanceof Error ? error.name : typeof error;

      // `TimeoutWaitingForTxIdError` is thrown by electric-db-collection when
      // the txid never appears in the stream — flag it distinctly because it
      // means the server *did* commit but the sync confirmation was lost.
      const isTxidTimeout = errorName === 'TimeoutWaitingForTxIdError';

      // eslint-disable-next-line no-console
      console.error(`[mutation:${isTxidTimeout ? 'timeout' : 'error'}] ${context}`, {
        mutationId,
        keys,
        elapsedMs,
        errorName,
        message,
        error,
      });

      toastService.error(message);
      posthog.captureException(error, { context, mutationId, elapsedMs, errorName });
      throw error;
    }
  };
}

/**
 * Subscribes to every change a collection observes (sync + local mutations)
 * and logs them with their virtual props (`$synced`, `$origin`).
 *
 * This is the missing piece for diagnosing the "archive comes back" bug:
 * if a row arrives from sync with `isArchived: false` after we already saw
 * it confirmed as `true`, that's the exact moment the UI silently reverts.
 *
 * Console-only. Returns the unsubscribe function.
 */
export function attachCollectionChangeLogger<T extends object, K extends string | number>(
  context: string,
  collection: Collection<T, K, any, any, any>,
  options: {
    /** Fields to include in the log per row (defaults: log entire row). */
    fields?: ReadonlyArray<keyof T>;
    /** Only log rows where this returns true (default: log all). */
    filter?: (row: T) => boolean;
  } = {},
): () => void {
  const { fields, filter } = options;

  const sub = collection.subscribeChanges((changes) => {
    for (const change of changes) {
      const row = change.value as T & { $synced?: boolean; $origin?: string };
      if (filter && !filter(row)) continue;

      const projected = fields ? Object.fromEntries(fields.map((f) => [f, row[f]])) : row;

      // eslint-disable-next-line no-console
      console.debug(`[sync:${context}] ${change.type} key=${String(change.key)}`, {
        $synced: row.$synced,
        $origin: row.$origin,
        ...projected,
      });
    }
  });

  return () => sub.unsubscribe();
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
  let retryCount = 0;

  return (error: unknown) => {
    const message = sanitizeErrorMessage(error);
    const status = error instanceof FetchError ? error.status : undefined;
    retryCount++;

    // eslint-disable-next-line no-console
    console.warn(`[sync:shape_fail] ${context}`, { status, message, retryCount, error });
    posthog.captureException(error, { context, status, retryCount });

    // 401 = session expired — stop retrying and redirect to login
    if (status === 401) {
      if (!hasToasted) {
        toastService.error('Session expired. Redirecting to login…');
        hasToasted = true;
      }

      window.location.href = '/login';
      return undefined; // stop syncing
    }

    if (!hasToasted) {
      toastService.error(message);
      hasToasted = true;
    }

    // Keep retrying for all other errors. Electric's own client adds exponential
    // backoff for 5xx/network, so this doesn't hammer the server.
    return {};
  };
}
