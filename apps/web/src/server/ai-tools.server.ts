import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

/**
 * Creates AI chat tools scoped to a specific user.
 * All tool handlers use dynamic imports to keep server deps lazy.
 */
export function createTools(userId: string, plan: string | null | undefined) {
  // -------------------------------------------------------------------------
  // discover_feeds — find RSS/Atom feeds at a URL
  // -------------------------------------------------------------------------
  const discoverFeeds = toolDefinition({
    name: 'discover_feeds',
    description:
      'Find RSS/Atom feeds at a given URL. Use when the user wants to subscribe to a website. Returns a list of discovered feed URLs with titles.',
    inputSchema: z.object({
      url: z.string().url().describe('The website URL to search for RSS/Atom feeds'),
    }),
  }).server(async ({ url }) => {
    const { discoverRssFeeds } = await import('@repo/domain');
    const feeds = await discoverRssFeeds(url);
    return {
      feeds: feeds.map((f) => ({
        url: f.url,
        title: f.title,
        description: f.description ?? null,
        siteUrl: f.siteUrl ?? null,
      })),
    };
  });

  // -------------------------------------------------------------------------
  // follow_feeds — subscribe to RSS feeds
  // -------------------------------------------------------------------------
  const followFeeds = toolDefinition({
    name: 'follow_feeds',
    description:
      'Subscribe to one or more RSS feeds. Use after discover_feeds to subscribe. Optionally assign tags.',
    inputSchema: z.object({
      feeds: z
        .array(
          z.object({
            feedUrl: z.string().url().describe('The feed URL to subscribe to'),
            title: z.string().optional().describe('Feed title'),
          }),
        )
        .min(1),
      tagNames: z
        .array(z.string())
        .optional()
        .describe(
          'Tag names to assign to the new feeds. Tags will be created if they do not exist.',
        ),
    }),
  }).server(async ({ feeds, tagNames }) => {
    const { db } = await import('@repo/db');
    const { followFeedsWithTags, withTransaction } = await import('@repo/domain');
    const { createId } = await import('@repo/shared/utils');

    const feedData = feeds.map((f) => ({
      id: createId(),
      feedUrl: f.feedUrl,
      title: f.title ?? null,
    }));

    const newTags = (tagNames ?? []).map((name) => ({
      id: createId(),
      name,
    }));

    const feedTags = feedData.flatMap((feed) =>
      newTags.map((tag) => ({
        id: createId(),
        feedId: feed.id,
        tagId: tag.id,
      })),
    );

    await withTransaction(db, userId, plan, async (ctx) => {
      await followFeedsWithTags(ctx, { feeds: feedData, newTags, feedTags });
    });

    return {
      subscribedCount: feedData.length,
      feedTitles: feedData.map((f) => f.title ?? f.feedUrl),
    };
  });

  // -------------------------------------------------------------------------
  // unfollow_feeds — unsubscribe from feeds
  // -------------------------------------------------------------------------
  const unfollowFeeds = toolDefinition({
    name: 'unfollow_feeds',
    description:
      "Unfollow/unsubscribe from RSS feeds. WARNING: This permanently removes the feed and all its articles from the user's library. Always confirm with the user before calling this tool — repeat back exactly which feed(s) will be removed and ask for explicit confirmation.",
    inputSchema: z.object({
      feedIds: z.array(z.string()).min(1).describe('Feed IDs to unsubscribe from'),
    }),
  }).server(async ({ feedIds }) => {
    const { db } = await import('@repo/db');
    const { deleteFeeds, withTransaction } = await import('@repo/domain');

    await withTransaction(db, userId, plan, async (ctx) => {
      await deleteFeeds(ctx, feedIds);
    });

    return { removedCount: feedIds.length };
  });

  // -------------------------------------------------------------------------
  // update_articles — mark read/unread, save, archive
  // -------------------------------------------------------------------------
  const updateArticles = toolDefinition({
    name: 'update_articles',
    description:
      'Update article properties. Can mark as read/unread, archived/unarchived. Set isRead=true to mark read, isRead=false to mark unread, isArchived=true to archive, isArchived=false to unarchive.',
    inputSchema: z.object({
      articleIds: z.array(z.string()).min(1).describe('Article IDs to update'),
      changes: z.object({
        isRead: z.boolean().optional().describe('Mark as read (true) or unread (false)'),
        isArchived: z.boolean().optional().describe('Archive (true) or unarchive (false)'),
      }),
    }),
  }).server(async ({ articleIds, changes }) => {
    const { db } = await import('@repo/db');
    const { updateArticles: domainUpdateArticles, withTransaction } = await import('@repo/domain');

    await withTransaction(db, userId, plan, async (ctx) => {
      await domainUpdateArticles(
        ctx,
        articleIds.map((id) => ({ id, ...changes })),
      );
    });

    return { updatedCount: articleIds.length };
  });

  // -------------------------------------------------------------------------
  // manage_tags — create, rename, or delete tags
  // -------------------------------------------------------------------------
  const manageTags = toolDefinition({
    name: 'manage_tags',
    description: 'Create, rename, or delete tags. For delete, confirm with the user first.',
    inputSchema: z.object({
      action: z.enum(['create', 'update', 'delete']),
      tags: z.array(
        z.object({
          id: z.string().optional().describe('Tag ID — required for update and delete'),
          name: z.string().optional().describe('Tag name — required for create and update'),
          color: z
            .enum([
              'red',
              'orange',
              'amber',
              'yellow',
              'lime',
              'green',
              'emerald',
              'teal',
              'cyan',
              'sky',
              'blue',
              'indigo',
              'violet',
              'purple',
              'fuchsia',
              'pink',
              'rose',
            ])
            .optional()
            .describe('Tag color'),
        }),
      ),
    }),
  }).server(async ({ action, tags }) => {
    const { db } = await import('@repo/db');
    const domain = await import('@repo/domain');
    const { withTransaction } = domain;

    await withTransaction(db, userId, plan, async (ctx) => {
      switch (action) {
        case 'create':
          await domain.createTags(
            ctx,
            tags.map((t) => ({ name: t.name!, color: t.color })),
          );
          break;
        case 'update':
          await domain.updateTags(
            ctx,
            tags.map((t) => ({ id: t.id!, name: t.name, color: t.color })),
          );
          break;
        case 'delete':
          await domain.deleteTags(
            ctx,
            tags.map((t) => t.id!),
          );
          break;
      }
    });

    return { success: true, action, count: tags.length };
  });

  // -------------------------------------------------------------------------
  // manage_feed_tags — assign or remove tags on feeds
  // -------------------------------------------------------------------------
  const manageFeedTags = toolDefinition({
    name: 'manage_feed_tags',
    description: 'Assign or remove tags on feeds.',
    inputSchema: z.object({
      action: z.enum(['assign', 'remove']),
      assignments: z.array(
        z.object({
          feedId: z.string().describe('Feed ID'),
          tagId: z.string().describe('Tag ID'),
        }),
      ),
    }),
  }).server(async ({ action, assignments }) => {
    const { db } = await import('@repo/db');
    const domain = await import('@repo/domain');
    const { withTransaction } = domain;
    const { createId } = await import('@repo/shared/utils');

    await withTransaction(db, userId, plan, async (ctx) => {
      if (action === 'assign') {
        await domain.createFeedTags(
          ctx,
          assignments.map((a) => ({ id: createId(), feedId: a.feedId, tagId: a.tagId })),
        );
      } else {
        // For removal, we need the feed-tag IDs — query them first
        const { feedTags: feedTagsTable } = await import('@repo/db');
        const { and, eq, inArray } = await import('drizzle-orm');

        const feedTagRows = await ctx.conn
          .select({ id: feedTagsTable.id })
          .from(feedTagsTable)
          .where(
            and(
              eq(feedTagsTable.userId, userId),
              inArray(
                feedTagsTable.feedId,
                assignments.map((a) => a.feedId),
              ),
              inArray(
                feedTagsTable.tagId,
                assignments.map((a) => a.tagId),
              ),
            ),
          );

        if (feedTagRows.length > 0) {
          await domain.deleteFeedTags(
            ctx,
            feedTagRows.map((r) => r.id),
          );
        }
      }
    });

    return { success: true, action, count: assignments.length };
  });

  // -------------------------------------------------------------------------
  // get_usage — check plan limits
  // -------------------------------------------------------------------------
  const getUsage = toolDefinition({
    name: 'get_usage',
    description:
      "Check the user's current plan usage and limits (feeds, saved articles, filter rules, etc.).",
    inputSchema: z.object({}),
  }).server(async () => {
    const { getUserUsage } = await import('@repo/domain');
    return await getUserUsage(userId, plan);
  });

  // -------------------------------------------------------------------------
  // list_feeds — query user's subscribed feeds
  // -------------------------------------------------------------------------
  const listFeeds = toolDefinition({
    name: 'list_feeds',
    description:
      "List the user's subscribed feeds. Returns feed ID, title, URL, and sync status. Use this to look up feed IDs for other operations.",
    inputSchema: z.object({
      search: z.string().optional().describe('Optional search term to filter by title or URL'),
    }),
  }).server(async ({ search }) => {
    const { db, feeds } = await import('@repo/db');
    const { eq, ilike, and, or } = await import('drizzle-orm');

    let query = db
      .select({
        id: feeds.id,
        title: feeds.title,
        feedUrl: feeds.feedUrl,
        url: feeds.url,
        syncStatus: feeds.syncStatus,
        icon: feeds.icon,
      })
      .from(feeds)
      .where(eq(feeds.userId, userId));

    if (search) {
      const pattern = `%${search}%`;
      query = db
        .select({
          id: feeds.id,
          title: feeds.title,
          feedUrl: feeds.feedUrl,
          url: feeds.url,
          syncStatus: feeds.syncStatus,
          icon: feeds.icon,
        })
        .from(feeds)
        .where(
          and(
            eq(feeds.userId, userId),
            or(
              ilike(feeds.title, pattern),
              ilike(feeds.feedUrl, pattern),
              ilike(feeds.url, pattern),
            ),
          ),
        );
    }

    const rows = await query.limit(50);
    return {
      feeds: rows.map((f) => ({
        id: f.id,
        title: f.title,
        feedUrl: f.feedUrl,
        url: f.url,
        syncStatus: f.syncStatus,
      })),
      count: rows.length,
    };
  });

  // -------------------------------------------------------------------------
  // list_articles — query user's articles
  // -------------------------------------------------------------------------
  const listArticles = toolDefinition({
    name: 'list_articles',
    description:
      "Query the user's articles. Can filter by feed, read/unread status, archived status. Returns article ID, title, feed info, and status. Limited to 30 results.",
    inputSchema: z.object({
      feedId: z.string().optional().describe('Filter by feed ID'),
      isRead: z.boolean().optional().describe('Filter by read status'),
      isArchived: z.boolean().optional().describe('Filter by archived status'),
      search: z.string().optional().describe('Search by article title'),
      limit: z.number().min(1).max(30).optional().describe('Max results (default 20)'),
    }),
  }).server(async ({ feedId, isRead, isArchived, search, limit: maxResults }) => {
    const { db, articles } = await import('@repo/db');
    const { eq, and, ilike, desc } = await import('drizzle-orm');

    const conditions = [eq(articles.userId, userId)];

    if (feedId) {
      conditions.push(eq(articles.feedId, feedId));
    }
    if (isRead !== undefined) {
      conditions.push(eq(articles.isRead, isRead));
    }
    if (isArchived !== undefined) {
      conditions.push(eq(articles.isArchived, isArchived));
    }
    if (search) {
      conditions.push(ilike(articles.title, `%${search}%`));
    }

    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        feedId: articles.feedId,
        isRead: articles.isRead,
        isArchived: articles.isArchived,
        pubDate: articles.pubDate,
      })
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.pubDate))
      .limit(maxResults ?? 20);

    return {
      articles: rows.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        feedId: a.feedId,
        isRead: a.isRead,
        isArchived: a.isArchived,
        pubDate: a.pubDate?.toISOString() ?? null,
      })),
      count: rows.length,
    };
  });

  // -------------------------------------------------------------------------
  // list_tags — query user's tags
  // -------------------------------------------------------------------------
  const listTags = toolDefinition({
    name: 'list_tags',
    description: "List all of the user's tags with their IDs, names, and colors.",
    inputSchema: z.object({}),
  }).server(async () => {
    const { db, tags } = await import('@repo/db');
    const { eq, asc } = await import('drizzle-orm');

    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        order: tags.order,
      })
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.order));

    return { tags: rows, count: rows.length };
  });

  return [
    discoverFeeds,
    followFeeds,
    unfollowFeeds,
    updateArticles,
    manageTags,
    manageFeedTags,
    getUsage,
    listFeeds,
    listArticles,
    listTags,
  ];
}
