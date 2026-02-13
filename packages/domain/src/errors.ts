export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? 'Resource not found');
  }
}

/** Maybe this should have a diff name */
export class BadRequestError extends Error {
  constructor(message?: string) {
    super(message ?? 'Bad Request');
  }
}

export class ConflictError extends Error {
  constructor(message?: string) {
    super(message ?? 'Resource already exists');
  }
}

export class UnexpectedError extends Error {
  constructor(message?: string) {
    super(message ?? 'An unexpected error occurred');
  }
}

export class AssertionError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

/**
 * Thrown when TTS feature is requested but not configured.
 * User-friendly message - safe to display to end users.
 */
export class TtsNotConfiguredError extends Error {
  constructor() {
    super('Text-to-speech is not available. Please contact the administrator.');
  }
}

/**
 * Thrown when a user exceeds a free-tier usage limit.
 *
 * Uses a `[LIMIT]` prefix in the message so the client can identify
 * these errors after TanStack Start serialization strips the class identity.
 *
 * @example
 * ```ts
 * throw new LimitExceededError('feeds', 100);
 * // message: "[LIMIT] You've reached the maximum of 100 feeds on the free plan."
 * ```
 */
export class LimitExceededError extends Error {
  public readonly resource: string;
  public readonly limit: number;

  constructor(resource: string, limit: number) {
    super(`[LIMIT] You've reached the maximum of ${limit} ${resource} on the free plan.`);
    this.resource = resource;
    this.limit = limit;
  }
}

/**
 * Check if a serialized error (from server) is a LimitExceededError.
 * After TanStack Start serialization, instanceof checks don't work,
 * so we check the message prefix instead.
 */
export function isLimitExceededError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('[LIMIT]');
}

/**
 * Extract a user-friendly message from a LimitExceededError.
 * Strips the `[LIMIT] ` prefix used for identification.
 */
export function getLimitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('[LIMIT] ')) {
    return error.message.slice('[LIMIT] '.length);
  }
  return 'You have reached a usage limit on the free plan.';
}

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
