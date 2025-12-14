import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  UnexpectedError,
} from '@repo/domain';
import { Elysia } from 'elysia';
import { logger } from './utils/logger';

/**
 * Centralized error handling plugin for Elysia apps.
 *
 * Handles:
 * - Domain errors (NotFoundError, ConflictError, BadRequestError, etc.)
 * - Elysia validation errors (VALIDATION)
 * - Unauthorized errors from authPlugin
 * - Unexpected errors with logging
 *
 * Usage:
 * ```typescript
 * export const myApp = new Elysia({ prefix: '/my-route' })
 *   .use(authPlugin)
 *   .use(errorHandlerPlugin)
 *   .get('/', handler)
 * ```
 */
export const errorHandlerPlugin = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, status, request, path }) => {
    // Handle Elysia validation errors
    if (code === 'VALIDATION') {
      return status(400, {
        error: 'Validation failed',
        message: error.message,
      });
    }

    // Handle Elysia not found errors
    if (code === 'NOT_FOUND') {
      return status(404, { error: 'Endpoint not found' });
    }

    // Handle domain errors with instanceof checks
    if (error instanceof NotFoundError) {
      return status(404, { error: error.message });
    }

    if (error instanceof ConflictError) {
      return status(409, { error: error.message });
    }

    if (error instanceof BadRequestError) {
      return status(400, { error: error.message });
    }

    if (error instanceof UnauthorizedError) {
      return status(401, { error: error.message });
    }

    // Handle other known error types by name/message
    if (error instanceof Error) {
      if (error.name === 'ForbiddenError') {
        return status(403, { error: error.message });
      }
      if (error.name === 'TooManyRequestsError') {
        return status(429, { error: error.message });
      }
      if (error.name === 'ValidationError') {
        return status(400, { error: error.message });
      }
    }

    if (error instanceof UnexpectedError) {
      logger.error(error, {
        method: request.method,
        path: path,
        url: request.url,
        errorType: 'unexpected',
      });
      return status(500, { error: 'Internal server error' });
    }

    // Unknown errors - log and return 500
    if (error instanceof Error) {
      logger.error(error, {
        method: request.method,
        path: path,
        url: request.url,
        errorType: 'unknown',
      });
    } else {
      logger.error(new Error(`Non-Error thrown: ${String(error)}`), {
        method: request.method,
        path: path,
        url: request.url,
        errorType: 'non-error',
        thrownValue: String(error),
      });
    }

    return status(500, { error: 'Internal server error' });
  })
  .as('scoped');
