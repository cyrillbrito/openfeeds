import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { articles, db, feeds, feedTags, tags } from '@repo/db';
import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { textResult } from './helpers';

/**
 * MCP tool: list_feeds
 *
 * Lists all feeds the user is subscribed to. Each feed includes:
 * - ID (needed for manage_feeds operations)
 * - Tags as an array of strings (not IDs)
 * - Unread article count
 * - A couple of recent article titles for context
 */
export function registerListFeeds(server: McpServer, userId: string) {
  server.registerTool(
    'list_feeds',
    {
      description:
        'List all RSS feed subscriptions. Returns each feed with its ID, title, URL, tags (as names), unread count, sync status, and recent article titles. Use this to get feed IDs for manage_feeds.',
      inputSchema: {},
    },
    async () => {
      try {
        const allFeeds = await db.query.feeds.findMany({
          where: eq(feeds.userId, userId),
        });

        if (allFeeds.length === 0) {
          return textResult({ feeds: [], total: 0 });
        }

        const feedIds = allFeeds.map((f) => f.id);

        // Fetch all feed-tag associations + tag names in one go
        const allFeedTags = await db
          .select({ feedId: feedTags.feedId, tagName: tags.name })
          .from(feedTags)
          .innerJoin(tags, eq(feedTags.tagId, tags.id))
          .where(eq(feedTags.userId, userId));

        const feedTagMap = new Map<string, string[]>();
        for (const ft of allFeedTags) {
          const existing = feedTagMap.get(ft.feedId) ?? [];
          existing.push(ft.tagName);
          feedTagMap.set(ft.feedId, existing);
        }

        // Fetch unread counts per feed
        const unreadCounts = await db
          .select({ feedId: articles.feedId, count: count() })
          .from(articles)
          .where(
            and(
              eq(articles.userId, userId),
              inArray(articles.feedId, feedIds),
              or(eq(articles.isRead, false), isNull(articles.isRead)),
              or(eq(articles.isArchived, false), isNull(articles.isArchived)),
            ),
          )
          .groupBy(articles.feedId);

        const unreadMap = new Map<string, number>();
        for (const row of unreadCounts) {
          if (row.feedId) unreadMap.set(row.feedId, row.count);
        }

        // Fetch 2 most recent articles per feed
        const recentArticles = await db.query.articles.findMany({
          where: and(eq(articles.userId, userId), inArray(articles.feedId, feedIds)),
          orderBy: desc(articles.pubDate),
          columns: { feedId: true, title: true, pubDate: true },
        });

        const recentByFeed = new Map<string, { title: string; pubDate: string | null }[]>();
        for (const a of recentArticles) {
          if (!a.feedId) continue;
          const existing = recentByFeed.get(a.feedId) ?? [];
          if (existing.length < 2) {
            existing.push({
              title: a.title,
              pubDate: a.pubDate?.toISOString() ?? null,
            });
            recentByFeed.set(a.feedId, existing);
          }
        }

        const enrichedFeeds = allFeeds.map((f) => ({
          id: f.id,
          title: f.title,
          url: f.url,
          feedUrl: f.feedUrl,
          description: f.description,
          syncStatus: f.syncStatus,
          tags: feedTagMap.get(f.id) ?? [],
          unreadCount: unreadMap.get(f.id) ?? 0,
          recentArticles: recentByFeed.get(f.id) ?? [],
        }));

        return textResult({ feeds: enrichedFeeds, total: enrichedFeeds.length });
      } catch (error) {
        return textResult(
          {
            error: `Failed to list feeds: ${error instanceof Error ? error.message : String(error)}`,
          },
          true,
        );
      }
    },
  );
}
