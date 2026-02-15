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
 * Message is user-friendly and displayed as-is on the client.
 */
export class LimitExceededError extends Error {
  public readonly resource: string;
  public readonly limit: number;

  constructor(resource: string, limit: number) {
    super(`You've reached the maximum of ${limit} ${resource} on the free plan.`);
    this.resource = resource;
    this.limit = limit;
  }
}

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
