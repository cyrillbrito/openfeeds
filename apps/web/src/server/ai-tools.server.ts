import {
  articles as articlesTable,
  db,
  feeds as feedsTable,
  feedTags as feedTagsTable,
  tags as tagsTable,
} from '@repo/db';
import {
  createDomainContext,
  createFeedTags,
  createTags,
  deleteFeeds,
  deleteFeedTags,
  deleteTags,
  discoverRssFeeds,
  followFeedsWithTags,
  getUserUsage,
  scopedQuery,
  updateArticles as domainUpdateArticles,
  updateTags,
  withTransaction,
} from '@repo/domain';
import { createId } from '@repo/shared/utils';
import { toolDefinition } from '@tanstack/ai';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';
import { z } from 'zod';

interface AiUser {
  id: string;
  plan: string | null | undefined;
}

/** Creates AI chat tools scoped to a specific user. */
export function createTools(user: AiUser) {
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
    const feedData = feeds.map((f) => ({
      id: createId(),
      feedUrl: f.feedUrl,
      title: f.title ?? null,
    }));

    await withTransaction(db, user.id, user.plan, async (ctx) => {
      // Look up existing tags by name so we reuse their IDs instead of
      // creating phantom IDs that cause FK violations in feed_tags.
      const q = scopedQuery(ctx);
      const existingTags =
        tagNames && tagNames.length > 0
          ? await q.db
              .select({ id: tagsTable.id, name: tagsTable.name })
              .from(tagsTable)
              .where(q.tags.where(inArray(tagsTable.name, tagNames)))
          : [];

      const existingByName = new Map(existingTags.map((t) => [t.name, t.id]));

      const newTags = (tagNames ?? [])
        .filter((name) => !existingByName.has(name))
        .map((name) => ({ id: createId(), name }));

      const allTagIds = (tagNames ?? []).map(
        (name) => existingByName.get(name) ?? newTags.find((t) => t.name === name)!.id,
      );

      const newFeedTags = feedData.flatMap((feed) =>
        allTagIds.map((tagId) => ({
          id: createId(),
          feedId: feed.id,
          tagId,
        })),
      );

      await followFeedsWithTags(ctx, { feeds: feedData, newTags, feedTags: newFeedTags });
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
    await withTransaction(db, user.id, user.plan, async (ctx) => {
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
    await withTransaction(db, user.id, user.plan, async (ctx) => {
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
    await withTransaction(db, user.id, user.plan, async (ctx) => {
      switch (action) {
        case 'create':
          await createTags(
            ctx,
            tags.map((t) => ({ name: t.name!, color: t.color })),
          );
          break;
        case 'update':
          await updateTags(
            ctx,
            tags.map((t) => ({ id: t.id!, name: t.name, color: t.color })),
          );
          break;
        case 'delete':
          await deleteTags(
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
    await withTransaction(db, user.id, user.plan, async (ctx) => {
      if (action === 'assign') {
        await createFeedTags(
          ctx,
          assignments.map((a) => ({ id: createId(), feedId: a.feedId, tagId: a.tagId })),
        );
      } else {
        // For removal, we need the feed-tag IDs — query them first.
        // Use exact (feedId, tagId) pairs via OR to avoid cartesian-product over-deletion.
        const q = scopedQuery(ctx);
        const pairConditions = assignments.map((a) =>
          and(eq(feedTagsTable.feedId, a.feedId), eq(feedTagsTable.tagId, a.tagId)),
        );
        const feedTagRows = await q.db
          .select({ id: feedTagsTable.id })
          .from(feedTagsTable)
          .where(q.feedTags.where(or(...pairConditions)));

        if (feedTagRows.length > 0) {
          await deleteFeedTags(
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
    return await getUserUsage(user.id, user.plan);
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
    const q = scopedQuery(createDomainContext(db, user.id, user.plan));

    const searchCondition = search
      ? or(
          ilike(feedsTable.title, `%${search}%`),
          ilike(feedsTable.feedUrl, `%${search}%`),
          ilike(feedsTable.url, `%${search}%`),
        )
      : undefined;

    const rows = await q.db
      .select({
        id: feedsTable.id,
        title: feedsTable.title,
        feedUrl: feedsTable.feedUrl,
        url: feedsTable.url,
        syncStatus: feedsTable.syncStatus,
      })
      .from(feedsTable)
      .where(q.feeds.where(searchCondition))
      .orderBy(asc(feedsTable.title));

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
      const q = scopedQuery(createDomainContext(db, user.id, user.plan));
      const limit = maxResults ?? 50;
      const skip = offset ?? 0;

      const conditions = [
        feedId ? eq(articlesTable.feedId, feedId) : undefined,
        isRead !== undefined ? eq(articlesTable.isRead, isRead) : undefined,
        isArchived !== undefined ? eq(articlesTable.isArchived, isArchived) : undefined,
        search ? ilike(articlesTable.title, `%${search}%`) : undefined,
        dateFrom ? gte(articlesTable.pubDate, new Date(dateFrom)) : undefined,
        dateTo ? lte(articlesTable.pubDate, new Date(dateTo)) : undefined,
      ].filter(Boolean);

      const whereClause = q.articles.where(...conditions);

      const [countResult, rows] = await Promise.all([
        q.db.select({ value: count() }).from(articlesTable).where(whereClause),
        q.db
          .select({
            id: articlesTable.id,
            title: articlesTable.title,
            url: articlesTable.url,
            description: articlesTable.description,
            author: articlesTable.author,
            feedId: articlesTable.feedId,
            feedTitle: feedsTable.title,
            isRead: articlesTable.isRead,
            isArchived: articlesTable.isArchived,
            pubDate: articlesTable.pubDate,
          })
          .from(articlesTable)
          .leftJoin(feedsTable, eq(articlesTable.feedId, feedsTable.id))
          .where(whereClause)
          .orderBy(desc(articlesTable.pubDate))
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
    const q = scopedQuery(createDomainContext(db, user.id, user.plan));

    const rows = await q.db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
        order: tagsTable.order,
      })
      .from(tagsTable)
      .where(q.tags.where())
      .orderBy(asc(tagsTable.order));

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

  return allTools;
}
