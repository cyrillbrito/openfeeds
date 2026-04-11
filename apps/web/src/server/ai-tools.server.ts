import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

/**
 * Creates AI chat tools scoped to a specific user.
 * All tool handlers use dynamic imports to keep server deps lazy.
 */
export function createTools(userId: string, plan: string | null | undefined) {
  // -------------------------------------------------------------------------
  // discover_feeds — find feeds at a URL
  // -------------------------------------------------------------------------
  const discoverFeeds = toolDefinition({
    name: 'discover_feeds',
    description:
      'Find available RSS/Atom feeds at a given URL. Use when the user wants to subscribe to a website or content source. Accepts any website URL and returns all discoverable feed URLs with their titles and descriptions. Call this before follow_feeds to show the user what feeds are available at a site.',
    inputSchema: z.object({
      url: z.string().url().describe('The website URL to search for feeds'),
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
  // follow_feeds — subscribe to feeds
  // -------------------------------------------------------------------------
  const followFeeds = toolDefinition({
    name: 'follow_feeds',
    description:
      'Subscribe the user to one or more feeds. Use after discover_feeds to subscribe. Accepts feed URLs (from discover_feeds results) and optionally assigns tags to all new feeds. Tags are created automatically if they do not already exist. Returns the count and titles of newly subscribed feeds.',
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
      "Unfollow/unsubscribe from feeds. WARNING: This permanently removes the feed and all its articles from the user's library. Always confirm with the user before calling this tool — repeat back exactly which feed(s) will be removed and ask for explicit confirmation. Requires feed IDs, which can be obtained from list_feeds.",
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
      'Update article properties in bulk. Can mark articles as read/unread or archived/unarchived. Accepts one or more article IDs (from list_articles) and the changes to apply. Set isRead=true to mark read, isRead=false to mark unread, isArchived=true to archive, isArchived=false to unarchive. You can combine both changes in a single call.',
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
    description:
      "Create, rename, or delete tags. For 'create', provide a name (and optional color). For 'update', provide the tag ID and the new name/color. For 'delete', provide the tag ID. Always confirm with the user before deleting tags. Tag IDs can be obtained from list_tags.",
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
    description:
      'Assign or remove tags on feeds. Use action "assign" to tag feeds and "remove" to untag them. Both feed IDs (from list_feeds) and tag IDs (from list_tags) are required. You can assign/remove multiple feed-tag pairs in a single call.',
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
      "Check the user's current plan usage and limits. Returns counts for feeds, saved articles, filter rules, and other plan-gated features along with their maximums. Use this when the user asks about their plan, remaining quota, or if they can add more feeds.",
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
      "List all of the user's subscribed feeds. Returns every feed with its ID, title, site URL, feed URL, and sync status. Use this to look up feed IDs before calling other tools like list_articles, unfollow_feeds, or manage_feed_tags. Supports an optional search filter to narrow by title or URL. Returns the full list (no pagination) since users typically have a manageable number of feeds.",
    inputSchema: z.object({
      search: z
        .string()
        .optional()
        .describe(
          'Optional search term to filter feeds by title, feed URL, or site URL (case-insensitive)',
        ),
    }),
  }).server(async ({ search }) => {
    const { db, feeds } = await import('@repo/db');
    const { eq, ilike, and, or, asc } = await import('drizzle-orm');

    const conditions = [eq(feeds.userId, userId)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(ilike(feeds.title, pattern), ilike(feeds.feedUrl, pattern), ilike(feeds.url, pattern))!,
      );
    }

    const rows = await db
      .select({
        id: feeds.id,
        title: feeds.title,
        feedUrl: feeds.feedUrl,
        url: feeds.url,
        syncStatus: feeds.syncStatus,
      })
      .from(feeds)
      .where(and(...conditions))
      .orderBy(asc(feeds.title));

    return {
      feeds: rows,
      totalCount: rows.length,
    };
  });

  // -------------------------------------------------------------------------
  // list_articles — query user's articles
  // -------------------------------------------------------------------------
  const listArticles = toolDefinition({
    name: 'list_articles',
    description:
      "Query the user's articles with filtering and pagination. Results are ordered by publication date (newest first). Default limit is 50; use offset to paginate. The response includes totalCount and hasMore for pagination. Use 'fields' to control which fields are returned — only request what you need. For digests/summaries of many articles, use fields: ['title', 'feedTitle', 'pubDate']. For actions like marking read, include 'id'. Requesting fewer fields saves context and avoids errors on large result sets.",
    inputSchema: z.object({
      feedId: z.string().optional().describe('Filter by feed ID'),
      isRead: z.boolean().optional().describe('Filter by read status'),
      isArchived: z.boolean().optional().describe('Filter by archived status'),
      search: z.string().optional().describe('Search by article title (case-insensitive)'),
      dateFrom: z
        .string()
        .optional()
        .describe('ISO 8601 date string — only return articles published on or after this date'),
      dateTo: z
        .string()
        .optional()
        .describe('ISO 8601 date string — only return articles published on or before this date'),
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .describe('Max results per page (default 50, max 200)'),
      offset: z.number().min(0).optional().describe('Number of results to skip (default 0)'),
      fields: z
        .array(
          z.enum([
            'id',
            'title',
            'pubDate',
            'feedId',
            'feedTitle',
            'isRead',
            'isArchived',
            'description',
            'url',
            'author',
          ]),
        )
        .optional()
        .describe(
          'Fields to include per article. Default: all base fields (id, title, pubDate, feedId, feedTitle, isRead, isArchived). For digests/overviews, use [title, feedTitle, pubDate] to minimize context. Add id when you need to reference articles in follow-up tool calls. Add description for content summaries (auto-truncated for large batches).',
        ),
    }),
  }).server(
    async ({
      feedId,
      isRead,
      isArchived,
      search,
      dateFrom,
      dateTo,
      limit: maxResults,
      offset,
      fields,
    }) => {
      const { db, articles, feeds } = await import('@repo/db');
      const { eq, and, ilike, desc, gte, lte, count } = await import('drizzle-orm');

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
      if (dateFrom) {
        conditions.push(gte(articles.pubDate, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(articles.pubDate, new Date(dateTo)));
      }

      const whereClause = and(...conditions);
      const limit = maxResults ?? 50;
      const skip = offset ?? 0;

      // Run count + data queries in parallel
      const [countResult, rows] = await Promise.all([
        db.select({ value: count() }).from(articles).where(whereClause),
        db
          .select({
            id: articles.id,
            title: articles.title,
            url: articles.url,
            description: articles.description,
            author: articles.author,
            feedId: articles.feedId,
            feedTitle: feeds.title,
            isRead: articles.isRead,
            isArchived: articles.isArchived,
            pubDate: articles.pubDate,
          })
          .from(articles)
          .leftJoin(feeds, eq(articles.feedId, feeds.id))
          .where(whereClause)
          .orderBy(desc(articles.pubDate))
          .limit(limit)
          .offset(skip),
      ]);

      const totalCount = countResult[0]?.value ?? 0;

      // If fields is specified, only return those fields. Otherwise return all base fields.
      const allBaseFields = [
        'id',
        'title',
        'pubDate',
        'feedId',
        'feedTitle',
        'isRead',
        'isArchived',
      ] as const;
      const requestedFields = new Set(fields ?? allBaseFields);

      // Scale description length inversely with batch size to prevent context overflow.
      const maxDescLength =
        rows.length <= 10 ? 800 : rows.length <= 50 ? 300 : rows.length <= 100 ? 150 : 0;

      return {
        articles: rows.map((a) => {
          const entry: Record<string, unknown> = {};
          if (requestedFields.has('id')) entry.id = a.id;
          if (requestedFields.has('title')) entry.title = a.title;
          if (requestedFields.has('pubDate')) {
            // Use short date for large batches to save tokens
            entry.pubDate =
              rows.length > 100
                ? (a.pubDate?.toISOString()?.slice(0, 10) ?? null)
                : (a.pubDate?.toISOString() ?? null);
          }
          if (requestedFields.has('feedId')) entry.feedId = a.feedId;
          if (requestedFields.has('feedTitle')) entry.feedTitle = a.feedTitle ?? null;
          if (requestedFields.has('isRead')) entry.isRead = a.isRead;
          if (requestedFields.has('isArchived')) entry.isArchived = a.isArchived;
          if (requestedFields.has('url')) entry.url = a.url;
          if (requestedFields.has('author')) entry.author = a.author ?? null;
          if (requestedFields.has('description') && maxDescLength > 0) {
            let descText = a.description ?? null;
            // Strip HTML tags — they waste tokens and add no information for the AI
            if (descText)
              descText = descText
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            entry.description =
              descText && descText.length > maxDescLength
                ? `${descText.slice(0, maxDescLength)}...`
                : descText;
          }
          return entry;
        }),
        totalCount,
        offset: skip,
        limit,
        hasMore: skip + rows.length < totalCount,
      };
    },
  );

  // -------------------------------------------------------------------------
  // list_tags — query user's tags
  // -------------------------------------------------------------------------
  const listTags = toolDefinition({
    name: 'list_tags',
    description:
      "List all of the user's tags with their IDs, names, colors, and sort order. Use this to look up tag IDs before calling manage_tags, manage_feed_tags, or filtering articles. Returns the complete list of tags since users typically have a small number.",
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: any[] = [
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

  // Dev-only tool to test error handling with large payloads
  if (process.env.NODE_ENV !== 'production') {
    const stressTest = toolDefinition({
      name: 'stress_test',
      description:
        'DEV ONLY: Generate a large text payload to test context limits. Use when the user asks to test context overflow or stress test.',
      inputSchema: z.object({
        sizeKb: z.number().min(1).max(1000).describe('Payload size in KB (default 500)'),
      }),
    }).server(({ sizeKb }) => {
      const size = (sizeKb ?? 500) * 1024;
      return { data: 'x'.repeat(size), sizeKb };
    });
    allTools.push(stressTest);
  }

  return allTools;
}
