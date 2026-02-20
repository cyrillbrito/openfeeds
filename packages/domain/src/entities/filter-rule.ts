import { db, filterRules } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { assert, NotFoundError } from '../errors';
import type { CreateFilterRule, UpdateFilterRule } from './filter-rule.schema';

// Re-export schemas and types from schema file
export * from './filter-rule.schema';

/** Existence + ownership guard. Throws NotFoundError if filter rule doesn't exist or doesn't belong to user. */
async function assertFilterRuleExists(id: string, userId: string): Promise<void> {
  const rule = await db.query.filterRules.findFirst({
    where: and(eq(filterRules.id, id), eq(filterRules.userId, userId)),
    columns: { id: true },
  });

  if (!rule) {
    throw new NotFoundError();
  }
}

export async function createFilterRule(data: CreateFilterRule, userId: string): Promise<void> {
  const createResult = await db
    .insert(filterRules)
    .values({
      id: data.id ?? createId(),
      userId,
      feedId: data.feedId,
      pattern: data.pattern,
      operator: data.operator,
      isActive: data.isActive,
    })
    .returning();

  const newRule = createResult[0];
  assert(newRule, 'Created filter rule must exist');

  trackEvent(userId, 'filters:rule_create', {
    feed_id: data.feedId,
    operator: newRule.operator,
  });
}

export async function updateFilterRule(
  id: string,
  data: UpdateFilterRule,
  userId: string,
): Promise<void> {
  await assertFilterRuleExists(id, userId);

  // Prepare update data (updatedAt auto-set by Drizzle $onUpdate)
  const ruleUpdateData: Partial<typeof filterRules.$inferInsert> = {};

  if (data.pattern !== undefined) {
    ruleUpdateData.pattern = data.pattern;
  }
  if (data.operator !== undefined) {
    ruleUpdateData.operator = data.operator;
  }
  if (data.isActive !== undefined) {
    ruleUpdateData.isActive = data.isActive;
  }

  await db
    .update(filterRules)
    .set(ruleUpdateData)
    .where(and(eq(filterRules.id, id), eq(filterRules.userId, userId)));
}

export async function deleteFilterRule(id: string, userId: string): Promise<void> {
  await assertFilterRuleExists(id, userId);

  await db.delete(filterRules).where(and(eq(filterRules.id, id), eq(filterRules.userId, userId)));
}
