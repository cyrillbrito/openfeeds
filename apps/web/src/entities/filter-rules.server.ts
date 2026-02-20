import * as filterRulesDomain from '@repo/domain';
import { CreateFilterRuleSchema, UpdateFilterRuleSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFilterRuleSchema))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map((rule) => filterRulesDomain.createFilterRule(rule, context.user.id)),
    );
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFilterRuleSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ id, ...updates }) =>
        filterRulesDomain.updateFilterRule(id, updates, context.user.id),
      ),
    );
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return Promise.all(ids.map((id) => filterRulesDomain.deleteFilterRule(id, context.user.id)));
  });
