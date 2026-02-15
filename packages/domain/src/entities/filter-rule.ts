import { articles, db, feeds, filterRules } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { filterRuleDbToApi } from '../db-utils';
import { assert, NotFoundError, UnexpectedError } from '../errors';
import {
  shouldMarkAsRead,
  type CreateFilterRuleApi,
  type FilterRule,
  type UpdateFilterRule,
} from './filter-rule.schema';

// Re-export schemas and types from schema file
export * from './filter-rule.schema';

export async function getAllFilterRules(userId: string): Promise<FilterRule[]> {
  // Now that filter_rules has user_id, we can filter directly
  const rules = await db.query.filterRules.findMany({
    where: eq(filterRules.userId, userId),
    orderBy: (filterRules, { asc }) => [asc(filterRules.createdAt)],
  });

  return rules.map(filterRuleDbToApi);
}

export async function getFilterRulesByFeedId(
  feedId: string,
  userId: string,
): Promise<FilterRule[]> {
  // Check if feed exists and belongs to user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Get all filter rules for this feed
  const rules = await db.query.filterRules.findMany({
    where: eq(filterRules.feedId, feedId),
    orderBy: (filterRules, { desc }) => [desc(filterRules.createdAt)],
  });

  return rules.map(filterRuleDbToApi);
}

export async function createFilterRule(
  feedId: string,
  data: CreateFilterRuleApi,
  userId: string,
): Promise<FilterRule> {
  // Check if feed exists and belongs to user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Create the filter rule
  let createResult: (typeof filterRules.$inferSelect)[];
  try {
    createResult = await db
      .insert(filterRules)
      .values({
        id: data.id ?? createId(),
        userId,
        feedId,
        pattern: data.pattern,
        operator: data.operator,
        isActive: data.isActive,
      })
      .returning();
  } catch (err) {
    console.error('Database error creating filter rule:', err);
    throw new UnexpectedError();
  }

  const newRule = createResult[0];
  assert(newRule, 'Created filter rule must exist');

  trackEvent(userId, 'filters:rule_create', {
    feed_id: feedId,
    operator: newRule.operator,
  });

  return filterRuleDbToApi(newRule);
}

export async function updateFilterRule(
  feedId: string,
  ruleId: string,
  data: UpdateFilterRule,
  userId: string,
): Promise<FilterRule> {
  // First verify the feed belongs to this user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Check if rule exists and belongs to the feed
  const existingRule = await db.query.filterRules.findFirst({
    where: and(eq(filterRules.id, ruleId), eq(filterRules.feedId, feedId)),
  });

  if (!existingRule) {
    throw new NotFoundError();
  }

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

  // Update the rule
  let updateResult: (typeof filterRules.$inferSelect)[];
  try {
    updateResult = await db
      .update(filterRules)
      .set(ruleUpdateData)
      .where(eq(filterRules.id, ruleId))
      .returning();
  } catch (err) {
    console.error('Database error updating filter rule:', err);
    throw new UnexpectedError();
  }

  const updatedRule = updateResult[0];
  assert(updatedRule, 'Updated filter rule must exist');

  return filterRuleDbToApi(updatedRule);
}

export async function deleteFilterRule(
  feedId: string,
  ruleId: string,
  userId: string,
): Promise<void> {
  // First verify the feed belongs to this user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Check if rule exists and belongs to the feed
  const existingRule = await db.query.filterRules.findFirst({
    where: and(eq(filterRules.id, ruleId), eq(filterRules.feedId, feedId)),
  });

  if (!existingRule) {
    throw new NotFoundError();
  }

  // Delete the rule
  await db.delete(filterRules).where(eq(filterRules.id, ruleId));
}

export async function applyFilterRulesToFeed(
  feedId: string,
  userId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  // Check if feed exists and belongs to user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Get all active filter rules for this feed
  const rules = await db.query.filterRules.findMany({
    where: and(eq(filterRules.feedId, feedId), eq(filterRules.isActive, true)),
  });

  if (rules.length === 0) {
    return { articlesProcessed: 0, articlesMarkedAsRead: 0 };
  }

  // Get all articles for this feed
  const feedArticles = await db.query.articles.findMany({
    where: eq(articles.feedId, feedId),
  });

  let articlesMarkedAsRead = 0;
  const articlesToUpdate: string[] = [];

  // Apply rules to each article
  for (const article of feedArticles) {
    const apiRules = rules.map(filterRuleDbToApi);
    if (shouldMarkAsRead(apiRules, article.title)) {
      articlesToUpdate.push(article.id);
      articlesMarkedAsRead++;
    }
  }

  // Bulk update articles to mark as read
  if (articlesToUpdate.length > 0) {
    for (const articleId of articlesToUpdate) {
      await db.update(articles).set({ isRead: true }).where(eq(articles.id, articleId));
    }
  }

  return {
    articlesProcessed: feedArticles.length,
    articlesMarkedAsRead,
  };
}
