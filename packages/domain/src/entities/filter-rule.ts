import { filterRules } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import type { TransactionContext } from '../domain-context';
import { LimitExceededError } from '../errors';
import { countUserFilterRules, FREE_TIER_LIMITS } from '../limits';
import type { CreateFilterRule, UpdateFilterRule } from './filter-rule.schema';

// Re-export schemas and types from schema file
export * from './filter-rule.schema';

export async function createFilterRules(
  ctx: TransactionContext,
  data: CreateFilterRule[],
): Promise<void> {
  if (data.length === 0) return;

  // Check free-tier filter rule limit
  const currentCount = await countUserFilterRules(ctx.userId, ctx.conn);
  if (currentCount + data.length > FREE_TIER_LIMITS.filterRules) {
    trackEvent(ctx.userId, 'limits:filter_rules_limit_hit', {
      current_usage: currentCount,
      limit: FREE_TIER_LIMITS.filterRules,
    });
    throw new LimitExceededError('filter rules', FREE_TIER_LIMITS.filterRules);
  }

  const values = data.map((item) => ({
    id: item.id ?? createId(),
    userId: ctx.userId,
    feedId: item.feedId,
    pattern: item.pattern,
    operator: item.operator,
    isActive: item.isActive,
  }));

  const inserted = await ctx.conn.insert(filterRules).values(values).returning();

  for (const rule of inserted) {
    trackEvent(ctx.userId, 'filters:rule_create', {
      operator: rule.operator,
    });
  }
}

export async function updateFilterRules(
  ctx: TransactionContext,
  data: UpdateFilterRule[],
): Promise<void> {
  if (data.length === 0) return;

  for (const { id, ...updates } of data) {
    const ruleUpdateData: Partial<typeof filterRules.$inferInsert> = {};

    if (updates.pattern !== undefined) ruleUpdateData.pattern = updates.pattern;
    if (updates.operator !== undefined) ruleUpdateData.operator = updates.operator;
    if (updates.isActive !== undefined) ruleUpdateData.isActive = updates.isActive;

    if (Object.keys(ruleUpdateData).length > 0) {
      await ctx.conn
        .update(filterRules)
        .set(ruleUpdateData)
        .where(and(eq(filterRules.id, id), eq(filterRules.userId, ctx.userId)));
    }
  }
}

export async function deleteFilterRules(ctx: TransactionContext, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await ctx.conn
    .delete(filterRules)
    .where(and(inArray(filterRules.id, ids), eq(filterRules.userId, ctx.userId)));
}
