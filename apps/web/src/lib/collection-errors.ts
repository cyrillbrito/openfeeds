import { toastService } from '~/lib/toast-service';

/**
 * Handle an error from a collection mutation handler (onInsert, onUpdate, onDelete).
 * Shows an error toast then re-throws so TanStack DB rolls back optimistic state.
 */
export function handleCollectionError(error: unknown, context: string): never {
  console.log('[handleCollectionError]', context, error); // TODO: REMOVE
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toastService.error(message);
  throw error;
}

/**
 * Handle an Electric shape stream error (sync/network layer).
 * Shows an error toast but does NOT throw — stream errors are informational.
 */
export function handleShapeError(error: unknown, context: string): void {
  console.log('[handleShapeError]', context, error); // TODO: REMOVE
  const message = error instanceof Error ? error.message : 'Sync connection error';
  toastService.error(message);
}
