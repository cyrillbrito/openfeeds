import { captureException } from './error-tracking';
import {
  AssertionError,
  BadRequestError,
  ConflictError,
  LimitExceededError,
  NotFoundError,
  TtsNotConfiguredError,
  UnauthorizedError,
  UnexpectedError,
} from './errors';

/** All domain error classes — these have user-safe messages and should pass through unchanged. */
const DOMAIN_ERRORS = [
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnexpectedError,
  UnauthorizedError,
  TtsNotConfiguredError,
  LimitExceededError,
  AssertionError,
] as const;

/** Returns true if the error is a known domain error (user-safe message). */
export function isDomainError(error: unknown): error is Error {
  return DOMAIN_ERRORS.some((cls) => error instanceof cls);
}

export type ErrorSource = 'server-function' | 'api-route' | 'worker';

export interface BoundaryErrorOptions {
  source: ErrorSource;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Processes an error at the transport boundary (server function, API route, worker).
 *
 * - **Domain errors** pass through unchanged — they already have user-safe messages.
 * - **Infrastructure errors** (Drizzle, Postgres, network, etc.):
 *   1. Logged to console with full cause chain
 *   2. Reported to PostHog server-side with cause preserved
 *   3. Replaced with a generic `UnexpectedError` so raw SQL / internal details never leak
 */
export function handleBoundaryError(error: unknown, opts: BoundaryErrorOptions): Error {
  if (isDomainError(error)) return error;

  // Infrastructure error — log full details server-side before sanitizing
  console.error(`[error-boundary] ${opts.source}`, error);

  const err = error instanceof Error ? error : new Error(String(error));
  captureException(err, opts);

  return new UnexpectedError();
}
