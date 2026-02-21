import { db, filterRules } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { LimitExceededError } from '../errors';
import { countUserFilterRules, FREE_TIER_LIMITS } from '../limits';
import type { CreateFilterRule, UpdateFilterRule } from './filter-rule.schema';

// Re-export schemas and types from schema file
export * from './filter-rule.schema';

export async function createFilterRules(data: CreateFilterRule[], userId: string): Promise<void> {
  if (data.length === 0) return;

  // Check free-tier filter rule limit
  const currentCount = await countUserFilterRules(userId);
  if (currentCount + data.length > FREE_TIER_LIMITS.filterRules) {
    trackEvent(userId, 'limits:filter_rules_limit_hit', {
      current_usage: currentCount,
      limit: FREE_TIER_LIMITS.filterRules,
    });
    throw new LimitExceededError('filter rules', FREE_TIER_LIMITS.filterRules);
  }

  const values = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    feedId: item.feedId,
    pattern: item.pattern,
    operator: item.operator,
    isActive: item.isActive,
  }));

  const inserted = await db.insert(filterRules).values(values).returning();

  for (const rule of inserted) {
    trackEvent(userId, 'filters:rule_create', {
      feed_id: rule.feedId,
      operator: rule.operator,
    });
  }
}

export async function updateFilterRules(data: UpdateFilterRule[], userId: string): Promise<void> {
  if (data.length === 0) return;

  await db.transaction(async (tx) => {
    for (const { id, ...updates } of data) {
      const ruleUpdateData: Partial<typeof filterRules.$inferInsert> = {};

      if (updates.pattern !== undefined) ruleUpdateData.pattern = updates.pattern;
      if (updates.operator !== undefined) ruleUpdateData.operator = updates.operator;
      if (updates.isActive !== undefined) ruleUpdateData.isActive = updates.isActive;

      if (Object.keys(ruleUpdateData).length > 0) {
        await tx
          .update(filterRules)
          .set(ruleUpdateData)
          .where(and(eq(filterRules.id, id), eq(filterRules.userId, userId)));
      }
    }
  });
}

export async function deleteFilterRules(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;

  await db
    .delete(filterRules)
    .where(and(inArray(filterRules.id, ids), eq(filterRules.userId, userId)));
}
