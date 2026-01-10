import { articles, feeds, filterRules, type UserDb } from '@repo/db';
import {
  type CreateFilterRuleApi,
  type FilterRule,
  type UpdateFilterRule,
} from '@repo/shared/types';
import { attemptAsync, createId, shouldMarkAsRead } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { filterRuleDbToApi } from './db-utils';
import { assert, NotFoundError, UnexpectedError } from './errors';

export async function getAllFilterRules(db: UserDb): Promise<FilterRule[]> {
  const rules = await db.query.filterRules.findMany({
    orderBy: (filterRules, { desc }) => [desc(filterRules.createdAt)],
  });
  return rules.map(filterRuleDbToApi);
}

export async function getFilterRulesByFeedId(feedId: string, db: UserDb): Promise<FilterRule[]> {
  // Check if feed exists
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
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
  data: CreateFilterRuleApi & { id?: string },
  db: UserDb,
): Promise<FilterRule> {
  // Check if feed exists
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  // Create the filter rule
  const [err, createResult] = await attemptAsync(
    db
      .insert(filterRules)
      .values({
        id: data.id ?? createId(),
        feedId,
        pattern: data.pattern,
        operator: data.operator,
        isActive: data.isActive,
      })
      .returning(),
  );

  if (err) {
    console.error('Database error creating filter rule:', err);
    throw new UnexpectedError();
  }

  const newRule = createResult[0];
  assert(newRule, 'Created filter rule must exist');

  return filterRuleDbToApi(newRule);
}

export async function updateFilterRule(
  feedId: string,
  ruleId: string,
  data: UpdateFilterRule,
  db: UserDb,
): Promise<FilterRule> {
  // Check if rule exists and belongs to the feed
  const existingRule = await db.query.filterRules.findFirst({
    where: and(eq(filterRules.id, ruleId), eq(filterRules.feedId, feedId)),
  });

  if (!existingRule) {
    throw new NotFoundError();
  }

  // Prepare update data
  const ruleUpdateData: any = {
    updatedAt: new Date(),
  };

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
  const [err, updateResult] = await attemptAsync(
    db.update(filterRules).set(ruleUpdateData).where(eq(filterRules.id, ruleId)).returning(),
  );

  if (err) {
    console.error('Database error updating filter rule:', err);
    throw new UnexpectedError();
  }

  const updatedRule = updateResult[0];
  assert(updatedRule, 'Updated filter rule must exist');

  return filterRuleDbToApi(updatedRule);
}

export async function deleteFilterRule(feedId: string, ruleId: string, db: UserDb): Promise<void> {
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
  db: UserDb,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  // Check if feed exists
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
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
