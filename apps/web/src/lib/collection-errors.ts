import { toastService } from '~/lib/toast-service';

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
      const message = error instanceof Error ? error.message : 'Something went wrong';
      toastService.error(message);
      throw error;
    }
  };
}

/**
 * Returns an Electric shape stream error handler.
 * Shows an error toast but does NOT throw — stream errors are informational.
 */
export function shapeErrorHandler(_context: string): (error: unknown) => void {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Sync connection error';
    toastService.error(message);
  };
}
