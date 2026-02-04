import {
  createFilterRule,
  createFilterRuleApiSchema,
  deleteFilterRule,
  getAllFilterRules,
  updateFilterRule,
  updateFilterRuleSchema,
} from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllFilterRules = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return getAllFilterRules(context.user.id);
  });

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(createFilterRuleApiSchema.extend({ feedId: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ feedId, ...rule }) => createFilterRule(feedId, rule, context.user.id)),
    );
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(updateFilterRuleSchema.extend({ feedId: z.string(), id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ feedId, id, ...updates }) =>
        updateFilterRule(feedId, id, updates, context.user.id),
      ),
    );
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.object({ feedId: z.string(), id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(data.map(({ feedId, id }) => deleteFilterRule(feedId, id, context.user.id)));
  });
