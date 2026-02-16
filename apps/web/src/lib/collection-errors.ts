type ErrorHandler = (message: string) => void;

let _errorHandler: ErrorHandler | null = null;

/**
 * Register a global handler for collection sync errors.
 * Called once from the ToastProvider to bridge the gap between
 * collection callbacks (no context access) and the toast UI.
 */
export function registerCollectionErrorHandler(handler: ErrorHandler): void {
  _errorHandler = handler;
}

/**
 * Handle an error from a collection callback (onInsert, onUpdate, onDelete).
 * Shows a user-friendly toast with the error message.
 */
export function handleCollectionError(error: unknown, context: string): void {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  if (_errorHandler) {
    _errorHandler(message);
  } else {
    console.error(`[${context}] Collection sync error:`, message);
  }
}
