import {
  createFeed,
  deleteFeed,
  discoverRssFeeds,
  getAllFeeds,
  syncFeed,
  updateFeed,
} from '@repo/domain';
import {
  CreateFeedSchema,
  DiscoveryRequestSchema,
  DiscoveryResponseSchema,
  FeedSchema,
  SyncResultSchema,
  UpdateFeedSchema,
} from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const feedsApp = new Elysia({ prefix: '/feeds' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/',
    async ({ db }) => {
      const feeds = await getAllFeeds(db);
      return feeds;
    },
    {
      response: FeedSchema.array(),
      detail: {
        tags: ['Feeds'],
        summary: 'List all feeds',
      },
    },
  )
  .post(
    '/',
    async ({ body, db, status }) => {
      const newFeed = await createFeed(body, db);
      return status(201, newFeed);
    },
    {
      body: CreateFeedSchema,
      response: {
        201: FeedSchema,
      },
      detail: {
        tags: ['Feeds'],
        summary: 'Create new feed',
      },
    },
  )
  .put(
    '/:id',
    async ({ params, body, db }) => {
      const updatedFeed = await updateFeed(params.id, body, db);
      return updatedFeed;
    },
    {
      params: z.object({ id: z.coerce.number() }),
      body: UpdateFeedSchema,
      response: FeedSchema,
      detail: {
        tags: ['Feeds'],
        summary: 'Update existing feed',
      },
    },
  )
  .delete(
    '/:id',
    async ({ params, db, status }) => {
      await deleteFeed(params.id, db);
      return status(204);
    },
    {
      params: z.object({ id: z.coerce.number() }),
      detail: {
        tags: ['Feeds'],
        summary: 'Delete feed',
      },
    },
  )
  .post(
    '/discover',
    async ({ body }) => {
      const discoveredFeeds = await discoverRssFeeds(body.url);
      return discoveredFeeds;
    },
    {
      body: DiscoveryRequestSchema,
      response: DiscoveryResponseSchema,
      detail: {
        tags: ['Feeds'],
        summary: 'Discover RSS feeds from URL',
      },
    },
  )
  .post(
    '/:id/sync',
    async ({ params, db }) => {
      const result = await syncFeed(params.id, db);
      return result;
    },
    {
      params: z.object({ id: z.coerce.number() }),
      response: SyncResultSchema,
      detail: {
        tags: ['Feeds'],
        summary: 'Sync feed articles',
      },
    },
  );
