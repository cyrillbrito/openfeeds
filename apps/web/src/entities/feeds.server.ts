import * as feedsDomain from '@repo/domain';
import { CreateFeedSchema, UpdateFeedSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$discoverFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: z.url() }))
  .handler(({ data }) => {
    return feedsDomain.discoverRssFeeds(data.url);
  });

export const $$importOpml = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ opmlContent: z.string() }))
  .handler(({ context, data }) => {
    return feedsDomain.importOpmlFeeds(data.opmlContent, context.user.id);
  });

export const $$exportOpml = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return feedsDomain.exportOpmlFeeds(context.user.id);
  });

export const $$getAllFeeds = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return feedsDomain.getAllFeeds(context.user.id);
  });

export const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedSchema))
  .handler(({ context, data }) => {
    return Promise.all(data.map((feed) => feedsDomain.createFeed(feed, context.user.id)));
  });

export const $$updateFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFeedSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ id, ...updates }) => feedsDomain.updateFeed(id, updates, context.user.id)),
    );
  });

export const $$deleteFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return Promise.all(ids.map((id) => feedsDomain.deleteFeed(id, context.user.id)));
  });
