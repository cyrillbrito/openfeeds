import { toastService } from '~/lib/toast-service';

/**
 * Handle an error from a collection mutation handler (onInsert, onUpdate, onDelete).
 * Shows an error toast then re-throws so TanStack DB rolls back optimistic state.
 */
function handleCollectionError(error: unknown, _context: string): never {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toastService.error(message);
  throw error;
}

/**
 * Wraps a collection mutation handler with error handling.
 * Catches errors, shows a toast, then re-throws so TanStack DB rolls back optimistic state.
 */
export function collectionErrorHandler<TArgs extends unknown[]>(
  _context: string,
  fn: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await fn(...args);
    } catch (error) {
      handleCollectionError(error, _context);
    }
  };
}

/**
 * Handle an Electric shape stream error (sync/network layer).
 * Shows an error toast but does NOT throw — stream errors are informational.
 */
export function handleShapeError(error: unknown, _context: string): void {
  const message = error instanceof Error ? error.message : 'Sync connection error';
  toastService.error(message);
}
