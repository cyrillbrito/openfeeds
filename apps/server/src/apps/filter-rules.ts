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
    async ({ params, user }) => {
      const rules = await getFilterRulesByFeedId(params.id, user.id);
      return rules;
    },
    {
      params: z.object({ id: z.string() }),
      response: filterRuleSchema.array(),
      detail: {
        tags: ['Filter Rules'],
        summary: 'List feed filter rules',
      },
    },
  )
  .post(
    '/feeds/:id/rules',
    async ({ params, body, status, user }) => {
      const newRule = await createFilterRule(params.id, body, user.id);
      return status(201, newRule);
    },
    {
      params: z.object({ id: z.string() }),
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
    async ({ params, body, user }) => {
      const updatedRule = await updateFilterRule(params.id, params.ruleId, body, user.id);
      return updatedRule;
    },
    {
      params: z.object({ id: z.string(), ruleId: z.string() }),
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
    async ({ params, status, user }) => {
      await deleteFilterRule(params.id, params.ruleId, user.id);
      return status(204);
    },
    {
      params: z.object({ id: z.string(), ruleId: z.string() }),
      detail: {
        tags: ['Filter Rules'],
        summary: 'Delete filter rule',
      },
    },
  )
  .post(
    '/feeds/:id/rules/apply',
    async ({ params, user }) => {
      const result = await applyFilterRulesToFeed(params.id, user.id);
      return result;
    },
    {
      params: z.object({ id: z.string() }),
      response: ApplyRulesResultSchema,
      detail: {
        tags: ['Filter Rules'],
        summary: 'Apply filter rules to articles',
      },
    },
  );
