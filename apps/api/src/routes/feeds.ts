import { db } from '@repo/db';
import {
  BadRequestError,
  ConflictError,
  LimitExceededError,
  createFeeds,
  handleBoundaryError,
  withTransaction,
} from '@repo/domain';
import { feedUrlSchema } from '@repo/domain/client';
import { Elysia, t } from 'elysia';
import { authPlugin, requireUser } from '~/middleware/auth';

/**
 * POST /api/feeds — create a feed for the authenticated user.
 *
 * Ported from apps/web/src/routes/api/feeds.ts. Same domain call, same error
 * mapping. Elysia's `t.Object` validates the body and Eden infers the type on
 * the client. Output schemas with `t.Object` give Eden a typed success body.
 */
export const feedsRoutes = new Elysia({ prefix: '/api2/feeds' }).use(authPlugin).post(
  '/',
  async ({ body, user, status }) => {
    requireUser(user);

    // Re-validate URL with the domain schema (Elysia validates the shape,
    // feedUrlSchema validates the URL semantics).
    const urlParsed = feedUrlSchema.safeParse(body.url);
    if (!urlParsed.success) {
      return status(400, { message: 'A valid URL is required' as const });
    }

    try {
      const [feed] = await withTransaction(db, user.id, user.plan, async (ctx) => {
        return createFeeds(ctx, [{ feedUrl: urlParsed.data }]);
      });
      return status(201, feed);
    } catch (error) {
      if (error instanceof LimitExceededError) {
        return status(429, { message: error.message });
      }
      if (error instanceof ConflictError) {
        return status(409, { message: error.message });
      }
      if (error instanceof BadRequestError) {
        return status(400, { message: error.message });
      }
      handleBoundaryError(error, {
        source: 'api-route',
        userId: user.id,
        operation: 'api_create_feed',
      });
      return status(500, { message: 'Internal server error' });
    }
  },
  {
    body: t.Object({
      url: t.String(),
    }),
  },
);
