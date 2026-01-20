import {
  createFilterRule,
  dbProvider,
  deleteFilterRule,
  getAllFilterRules,
  updateFilterRule,
} from '@repo/domain';
import { createFilterRuleApiSchema, updateFilterRuleSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllFilterRules = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return getAllFilterRules(db);
  });

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(createFilterRuleApiSchema.extend({ feedId: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ feedId, ...rule }) => createFilterRule(feedId, rule, db)));
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(updateFilterRuleSchema.extend({ feedId: z.string(), id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(
      data.map(({ feedId, id, ...updates }) => updateFilterRule(feedId, id, updates, db)),
    );
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.object({ feedId: z.string(), id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ feedId, id }) => deleteFilterRule(feedId, id, db)));
  });
