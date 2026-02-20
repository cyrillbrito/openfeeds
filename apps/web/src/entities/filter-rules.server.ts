import * as filterRulesDomain from '@repo/domain';
import { CreateFilterRuleSchema, UpdateFilterRuleSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFilterRuleSchema))
  .handler(({ context, data }) => {
    return filterRulesDomain.createFilterRules(data, context.user.id);
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFilterRuleSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return filterRulesDomain.updateFilterRules(data, context.user.id);
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return filterRulesDomain.deleteFilterRules(ids, context.user.id);
  });
