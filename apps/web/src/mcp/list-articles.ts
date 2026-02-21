import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { articles, db, feeds, feedTags, tags } from '@repo/db';
import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { textResult } from './helpers';

/**
 * MCP tool: list_articles
 *
 * Lists articles from the user's RSS reader. Supports filtering by:
 * - feed (matched by website URL or title, not internal ID)
 * - tag (matched by tag name, not internal ID)
 * - inbox mode (unread + non-archived, the default view)
 * - read/archived status
 *
 * Returns articles with feed name and tags inlined so the LLM never
 * needs a follow-up call to understand context.
 */
export function registerListArticles(server: McpServer, userId: string) {
  server.registerTool(
    'list_articles',
    {
      description:
        'Get articles from the RSS reader. Filter by feed (URL or title), tag name, or read/archive status. ' +
        'Defaults to inbox view (unread & non-archived). Returns article IDs needed for manage_articles.',
      inputSchema: {
        feed: z
          .string()
          .optional()
          .describe(
            'Filter by feed. Pass the website URL, feed URL, or feed title (partial match).',
          ),
        tag: z
          .string()
          .optional()
          .describe('Filter by tag name (e.g. "tech", "news"). Case-insensitive.'),
        is_read: z.boolean().optional().describe('Filter by read status. Omit to include both.'),
        is_archived: z
          .boolean()
          .optional()
          .describe('Filter by archived status. Omit to include both.'),
        inbox: z
          .boolean()
          .optional()
          .describe(
            'When true, returns only unread and non-archived articles (the inbox view). Defaults to true if no other filter is set.',
          ),
        limit: z.number().optional().describe('Max articles to return. Defaults to 20, max 100.'),
      },
    },
    async ({ feed, tag, is_read, is_archived, inbox, limit: rawLimit }) => {
      const limit = Math.min(rawLimit ?? 20, 100);

      try {
        // Resolve feed filter -> feed IDs
        let feedIds: string[] | undefined;
        if (feed) {
          const matchedFeeds = await db.query.feeds.findMany({
            where: and(
              eq(feeds.userId, userId),
              or(
                like(feeds.url, `%${feed}%`),
                like(feeds.feedUrl, `%${feed}%`),
                like(feeds.title, `%${feed}%`),
              ),
            ),
          });
          feedIds = matchedFeeds.map((f) => f.id);

          if (feedIds.length === 0) {
            return textResult({
              error: `No feed found matching "${feed}". Use list_feeds to see available feeds.`,
            });
          }
        }

        // Resolve tag filter -> feed IDs via feed-tag junction
        if (tag) {
          const allUserTags = await db.query.tags.findMany({
            where: eq(tags.userId, userId),
          });
          const ciMatch = allUserTags.find((t) => t.name.toLowerCase() === tag.toLowerCase());

          if (!ciMatch) {
            return textResult({
              error: `No tag found matching "${tag}". Use list_feeds (which includes tags) to see available tags.`,
              availableTags: allUserTags.map((t) => t.name),
            });
          }

          const taggedFeeds = await db.query.feedTags.findMany({
            where: eq(feedTags.tagId, ciMatch.id),
          });
          const tagFeedIds = taggedFeeds.map((ft) => ft.feedId);

          if (feedIds) {
            feedIds = feedIds.filter((id) => tagFeedIds.includes(id));
          } else {
            feedIds = tagFeedIds;
          }

          if (feedIds.length === 0) {
            return textResult({ articles: [], count: 0, hasMore: false });
          }
        }

        // Build where conditions
        const conditions = [eq(articles.userId, userId)];

        if (feedIds) {
          conditions.push(inArray(articles.feedId, feedIds));
        }

        // Explicit read/archived filters take priority over inbox mode
        const hasExplicitFilters =
          is_read !== undefined || is_archived !== undefined || feed || tag;

        if (is_read !== undefined) {
          conditions.push(eq(articles.isRead, is_read));
        }
        if (is_archived !== undefined) {
          conditions.push(eq(articles.isArchived, is_archived));
        }

        // Default to inbox mode if no explicit filters set
        const useInbox = inbox ?? !hasExplicitFilters;
        if (useInbox && is_read === undefined && is_archived === undefined) {
          conditions.push(or(eq(articles.isRead, false), isNull(articles.isRead))!);
          conditions.push(or(eq(articles.isArchived, false), isNull(articles.isArchived))!);
        }

        const results = await db.query.articles.findMany({
          where: and(...conditions),
          orderBy: desc(articles.pubDate),
          limit,
        });

        // Build lookup maps for enrichment
        const relevantFeedIds = [
          ...new Set(results.map((a) => a.feedId).filter(Boolean) as string[]),
        ];

        const feedMap = new Map<string, { title: string; url: string }>();
        if (relevantFeedIds.length > 0) {
          const feedRows = await db.query.feeds.findMany({
            where: inArray(feeds.id, relevantFeedIds),
          });
          for (const f of feedRows) {
            feedMap.set(f.id, { title: f.title, url: f.url });
          }
        }

        const enrichedArticles = results.map((a) => {
          const feedInfo = a.feedId ? feedMap.get(a.feedId) : null;
          return {
            id: a.id,
            title: a.title,
            url: a.url,
            author: a.author,
            feedName: feedInfo?.title ?? null,
            feedUrl: feedInfo?.url ?? null,
            description: a.description,
            pubDate: a.pubDate?.toISOString() ?? null,
            isRead: a.isRead ?? false,
            isArchived: a.isArchived ?? false,
          };
        });

        return textResult({
          articles: enrichedArticles,
          count: enrichedArticles.length,
          hasMore: results.length === limit,
        });
      } catch (error) {
        return textResult(
          {
            error: `Failed to list articles: ${error instanceof Error ? error.message : String(error)}`,
          },
          true,
        );
      }
    },
  );
}
