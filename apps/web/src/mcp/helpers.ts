import { articles, articleTags, db, feedTags, tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray, sql } from 'drizzle-orm';

/**
 * Resolve tag names to tag IDs, auto-creating any that don't exist yet.
 * Case-insensitive matching. Returns a Map of lowercase name → tag ID.
 */
export async function resolveTagNames(
  names: string[],
  userId: string,
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  const lowerNames = names.map((n) => n.toLowerCase());

  // Find existing tags (case-insensitive)
  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, lowerNames)));

  const result = new Map<string, string>();
  for (const tag of existing) {
    result.set(tag.name.toLowerCase(), tag.id);
  }

  // Create missing tags
  const missing = names.filter((n) => !result.has(n.toLowerCase()));
  if (missing.length > 0) {
    // Deduplicate by lowercase
    const uniqueMissing = [...new Map(missing.map((n) => [n.toLowerCase(), n])).values()];
    const newTags = uniqueMissing.map((name) => ({
      id: createId(),
      userId,
      name,
      color: null,
    }));

    const inserted = await db.insert(tags).values(newTags).returning();
    for (const tag of inserted) {
      result.set(tag.name.toLowerCase(), tag.id);
    }
  }

  return result;
}

/**
 * Add tags to feeds by name. Auto-creates tags that don't exist.
 * Also propagates: adds these tags to all existing articles of the affected feeds.
 */
export async function addTagsToFeeds(
  feedIds: string[],
  tagNames: string[],
  userId: string,
): Promise<void> {
  if (feedIds.length === 0 || tagNames.length === 0) return;

  const tagMap = await resolveTagNames(tagNames, userId);
  const tagIdValues = [...tagMap.values()];

  const values = feedIds.flatMap((feedId) =>
    tagIdValues.map((tagId) => ({
      id: createId(),
      userId,
      feedId,
      tagId,
    })),
  );

  if (values.length > 0) {
    await db.insert(feedTags).values(values).onConflictDoNothing();

    // Propagate to articles: add these tags to all existing articles of the feeds
    const feedArticles = await db
      .select({ id: articles.id, feedId: articles.feedId })
      .from(articles)
      .where(and(eq(articles.userId, userId), inArray(articles.feedId, feedIds)));

    if (feedArticles.length > 0) {
      const articleTagValues = feedArticles.flatMap((article) =>
        tagIdValues.map((tagId) => ({
          id: createId(),
          userId,
          articleId: article.id,
          tagId,
        })),
      );

      await db.insert(articleTags).values(articleTagValues).onConflictDoNothing();
    }
  }
}

/**
 * Remove tags from feeds by name. Silently ignores tags that don't exist.
 * Also propagates: removes these tags from all articles of the affected feeds.
 */
export async function removeTagsFromFeeds(
  feedIds: string[],
  tagNames: string[],
  userId: string,
): Promise<void> {
  if (feedIds.length === 0 || tagNames.length === 0) return;

  const lowerNames = tagNames.map((n) => n.toLowerCase());
  const matchedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, lowerNames)));

  const tagIdValues = matchedTags.map((t) => t.id);
  if (tagIdValues.length === 0) return;

  await db
    .delete(feedTags)
    .where(
      and(
        eq(feedTags.userId, userId),
        inArray(feedTags.feedId, feedIds),
        inArray(feedTags.tagId, tagIdValues),
      ),
    );

  // Propagate to articles: remove these tags from all articles of the affected feeds
  const feedArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.userId, userId), inArray(articles.feedId, feedIds)));

  const articleIds = feedArticles.map((a) => a.id);
  if (articleIds.length > 0) {
    await db
      .delete(articleTags)
      .where(
        and(
          eq(articleTags.userId, userId),
          inArray(articleTags.articleId, articleIds),
          inArray(articleTags.tagId, tagIdValues),
        ),
      );
  }
}

/**
 * Add tags to articles by name. Auto-creates tags that don't exist.
 */
export async function addTagsToArticles(
  articleIds: string[],
  tagNames: string[],
  userId: string,
): Promise<void> {
  if (articleIds.length === 0 || tagNames.length === 0) return;

  const tagMap = await resolveTagNames(tagNames, userId);
  const tagIdValues = [...tagMap.values()];

  const values = articleIds.flatMap((articleId) =>
    tagIdValues.map((tagId) => ({
      id: createId(),
      userId,
      articleId,
      tagId,
    })),
  );

  if (values.length > 0) {
    await db.insert(articleTags).values(values).onConflictDoNothing();
  }
}

/**
 * Remove tags from articles by name. Silently ignores tags that don't exist.
 */
export async function removeTagsFromArticles(
  articleIds: string[],
  tagNames: string[],
  userId: string,
): Promise<void> {
  if (articleIds.length === 0 || tagNames.length === 0) return;

  const lowerNames = tagNames.map((n) => n.toLowerCase());
  const matchedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, lowerNames)));

  const tagIdValues = matchedTags.map((t) => t.id);
  if (tagIdValues.length === 0) return;

  await db
    .delete(articleTags)
    .where(
      and(
        eq(articleTags.userId, userId),
        inArray(articleTags.articleId, articleIds),
        inArray(articleTags.tagId, tagIdValues),
      ),
    );
}

/** Standard JSON text response for MCP tools */
export function textResult(data: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    ...(isError ? { isError: true } : {}),
  };
}

/** Wrap an MCP tool handler with standard error handling */
export function withErrorHandler(
  toolName: string,
  handler: (...args: never[]) => Promise<ReturnType<typeof textResult>>,
) {
  return async (...args: never[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return textResult(
        { error: `${toolName} failed: ${error instanceof Error ? error.message : String(error)}` },
        true,
      );
    }
  };
}
