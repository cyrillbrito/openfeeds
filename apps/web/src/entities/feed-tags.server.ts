import * as feedTagsDomain from '@repo/domain';
import { CreateFeedTagSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllFeedTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return feedTagsDomain.getAllFeedTags(context.user.id);
  });

export const $$createFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedTagSchema))
  .handler(({ context, data }) => {
    return feedTagsDomain.createFeedTags(data, context.user.id);
  });

export const $$deleteFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return feedTagsDomain.deleteFeedTags(ids, context.user.id);
  });
