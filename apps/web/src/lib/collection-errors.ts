import { getLimitErrorMessage, isLimitExceededError } from '@repo/domain/client';

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
 * If the error is a LimitExceededError, shows a user-friendly toast.
 * Other errors are logged to console.
 */
export function handleCollectionError(error: unknown, context: string): void {
  if (isLimitExceededError(error)) {
    const message = getLimitErrorMessage(error);
    if (_errorHandler) {
      _errorHandler(message);
    } else {
      console.error(`[${context}] Limit exceeded:`, message);
    }
  } else {
    console.error(`[${context}] Collection sync error:`, error);
  }
}
