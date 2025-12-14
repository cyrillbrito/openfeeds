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

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
