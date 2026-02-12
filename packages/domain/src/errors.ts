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

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
