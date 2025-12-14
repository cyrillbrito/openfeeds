import {
  applyFilterRulesToFeed,
  createFilterRule,
  deleteFilterRule,
  getFilterRulesByFeedId,
  updateFilterRule,
} from '@repo/domain';
import {
  createFilterRuleApiSchema,
  filterRuleSchema,
  updateFilterRuleSchema,
} from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

const ApplyRulesResultSchema = z.object({
  articlesProcessed: z.number(),
  articlesMarkedAsRead: z.number(),
});

export const filterRulesApp = new Elysia()
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/feeds/:id/rules',
    async ({ params, db }) => {
      const rules = await getFilterRulesByFeedId(params.id, db);
      return rules;
    },
    {
      params: z.object({ id: z.coerce.number() }),
      response: filterRuleSchema.array(),
      detail: {
        tags: ['Filter Rules'],
        summary: 'List feed filter rules',
      },
    },
  )
  .post(
    '/feeds/:id/rules',
    async ({ params, body, db, status }) => {
      const newRule = await createFilterRule(params.id, body, db);
      return status(201, newRule);
    },
    {
      params: z.object({ id: z.coerce.number() }),
      body: createFilterRuleApiSchema,
      response: {
        201: filterRuleSchema,
      },
      detail: {
        tags: ['Filter Rules'],
        summary: 'Create feed filter rule',
      },
    },
  )
  .put(
    '/feeds/:id/rules/:ruleId',
    async ({ params, body, db }) => {
      const updatedRule = await updateFilterRule(params.id, params.ruleId, body, db);
      return updatedRule;
    },
    {
      params: z.object({ id: z.coerce.number(), ruleId: z.coerce.number() }),
      body: updateFilterRuleSchema,
      response: filterRuleSchema,
      detail: {
        tags: ['Filter Rules'],
        summary: 'Update filter rule',
      },
    },
  )
  .delete(
    '/feeds/:id/rules/:ruleId',
    async ({ params, db, status }) => {
      await deleteFilterRule(params.id, params.ruleId, db);
      return status(204);
    },
    {
      params: z.object({ id: z.coerce.number(), ruleId: z.coerce.number() }),
      detail: {
        tags: ['Filter Rules'],
        summary: 'Delete filter rule',
      },
    },
  )
  .post(
    '/feeds/:id/rules/apply',
    async ({ params, db }) => {
      const result = await applyFilterRulesToFeed(params.id, db);
      return result;
    },
    {
      params: z.object({ id: z.coerce.number() }),
      response: ApplyRulesResultSchema,
      detail: {
        tags: ['Filter Rules'],
        summary: 'Apply filter rules to articles',
      },
    },
  );
