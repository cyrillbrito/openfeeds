/**
 * MCP tool definitions for OpenFeeds.
 *
 * Four tools following the "fewer, more powerful tools" pattern:
 * - get_articles: Query and search articles
 * - manage_articles: Mark read/unread, archive, tag articles
 * - get_feeds: List feeds and tags
 * - manage_feeds: Subscribe/unsubscribe, update feeds, manage tags
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createArticleTags,
  createFeed,
  createTag,
  deleteArticleTags,
  deleteFeed,
  deleteTag,
  discoverRssFeeds,
  getAllFeeds,
  getAllTags,
  getArticles,
  getArticleWithContent,
  markManyArticlesArchived,
  updateArticle,
  updateFeed,
  updateTag,
} from '@repo/domain';
import { z } from 'zod';

export function registerTools(server: McpServer) {
  // ─── GET ARTICLES ───────────────────────────────────────────────
  server.tool(
    'get_articles',
    `Query and search articles. Supports filtering by feed, tag, read status, archived status, and full-text search.
Returns paginated results with cursor-based pagination.
Use "action": "get_content" with an article ID to get the full clean content of a specific article.`,
    {
      action: z
        .enum(['list', 'get_content'])
        .describe('list = search/filter articles, get_content = get full article content by ID'),
      // Filters for "list" action
      feedId: z.string().optional().describe('Filter by feed ID'),
      tagId: z.string().optional().describe('Filter by tag ID'),
      search: z.string().optional().describe('Full-text search query'),
      isRead: z.boolean().optional().describe('Filter by read status'),
      isArchived: z.boolean().optional().describe('Filter by archived status (default: false)'),
      limit: z.number().optional().describe('Max results to return (default: 20, max: 100)'),
      cursor: z.string().optional().describe('Pagination cursor from previous response'),
      // For "get_content" action
      articleId: z.string().optional().describe('Article ID (required for get_content action)'),
    },
    async (
      { action, feedId, tagId, search, isRead, isArchived, limit, cursor, articleId },
      extra,
    ) => {
      const userId = extra.authInfo?.extra?.userId as string;
      if (!userId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not authenticated' }],
          isError: true,
        };
      }

      try {
        if (action === 'get_content') {
          if (!articleId) {
            return {
              content: [
                { type: 'text' as const, text: 'Error: articleId is required for get_content' },
              ],
              isError: true,
            };
          }
          const article = await getArticleWithContent(articleId, userId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    author: article.author,
                    pubDate: article.pubDate,
                    cleanContent: article.cleanContent,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // list action
        const effectiveLimit = Math.min(limit ?? 20, 100);
        const result = await getArticles(
          {
            feedId,
            tagId,
            search,
            isRead,
            isArchived,
            limit: effectiveLimit,
            cursor,
          },
          userId,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  total: result.total,
                  count: result.data.length,
                  nextCursor: result.nextCursor,
                  articles: result.data.map((a) => ({
                    id: a.id,
                    title: a.title,
                    url: a.url,
                    feedId: a.feedId,
                    author: a.author,
                    pubDate: a.pubDate,
                    isRead: a.isRead,
                    isArchived: a.isArchived,
                    hasCleanContent: a.hasCleanContent,
                    description: a.description?.slice(0, 200),
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ─── MANAGE ARTICLES ────────────────────────────────────────────
  server.tool(
    'manage_articles',
    `Perform actions on articles: mark as read/unread, archive/unarchive, bulk archive, and tag/untag articles.`,
    {
      action: z
        .enum(['update', 'bulk_archive', 'add_tags', 'remove_tags'])
        .describe(
          'update = mark read/unread/archive single article, bulk_archive = archive many, add_tags/remove_tags = manage article tags',
        ),
      articleId: z
        .string()
        .optional()
        .describe('Article ID (required for update, add_tags, remove_tags)'),
      // For "update" action
      isRead: z.boolean().optional().describe('Set read status'),
      isArchived: z.boolean().optional().describe('Set archived status'),
      // For "bulk_archive" action
      archiveContext: z
        .enum(['all', 'feed', 'tag'])
        .optional()
        .describe('Scope of bulk archive: all articles, by feed, or by tag'),
      feedId: z.string().optional().describe('Feed ID for bulk_archive with context "feed"'),
      tagId: z
        .string()
        .optional()
        .describe('Tag ID for bulk_archive with context "tag" or for add_tags/remove_tags'),
      // For "add_tags" / "remove_tags"
      tagIds: z.array(z.string()).optional().describe('Tag IDs to add/remove from the article'),
    },
    async (
      { action, articleId, isRead, isArchived, archiveContext, feedId, tagId, tagIds },
      extra,
    ) => {
      const userId = extra.authInfo?.extra?.userId as string;
      if (!userId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not authenticated' }],
          isError: true,
        };
      }

      try {
        if (action === 'update') {
          if (!articleId) {
            return {
              content: [{ type: 'text' as const, text: 'Error: articleId is required for update' }],
              isError: true,
            };
          }
          const updated = await updateArticle(articleId, { isRead, isArchived }, userId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ success: true, article: updated }, null, 2),
              },
            ],
          };
        }

        if (action === 'bulk_archive') {
          if (!archiveContext) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Error: archiveContext is required for bulk_archive',
                },
              ],
              isError: true,
            };
          }
          const result = await markManyArticlesArchived(
            { context: archiveContext, feedId, tagId },
            userId,
          );
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        if (action === 'add_tags') {
          if (!articleId || !tagIds?.length) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Error: articleId and tagIds are required for add_tags',
                },
              ],
              isError: true,
            };
          }
          const created = await createArticleTags(
            tagIds.map((tId) => ({ articleId, tagId: tId })),
            userId,
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ success: true, count: created.length }, null, 2),
              },
            ],
          };
        }

        if (action === 'remove_tags') {
          if (!tagIds?.length) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Error: tagIds (article-tag association IDs) required for remove_tags',
                },
              ],
              isError: true,
            };
          }
          await deleteArticleTags(tagIds, userId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true }, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: `Error: Unknown action "${action}"` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ─── GET FEEDS ──────────────────────────────────────────────────
  server.tool(
    'get_feeds',
    `List all feeds and/or tags. Returns feed details including title, URL, icon, and associated tags.
Use action "list_feeds" to get all subscribed feeds, "list_tags" to get all tags, or "discover" to find RSS feeds at a URL.`,
    {
      action: z
        .enum(['list_feeds', 'list_tags', 'discover'])
        .describe(
          'list_feeds = all subscribed feeds, list_tags = all tags, discover = find RSS feeds at a URL',
        ),
      url: z
        .string()
        .optional()
        .describe('URL to discover RSS feeds from (required for discover action)'),
    },
    async ({ action, url }, extra) => {
      const userId = extra.authInfo?.extra?.userId as string;
      if (!userId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not authenticated' }],
          isError: true,
        };
      }

      try {
        if (action === 'list_feeds') {
          const feeds = await getAllFeeds(userId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    count: feeds.length,
                    feeds: feeds.map((f) => ({
                      id: f.id,
                      title: f.title,
                      feedUrl: f.feedUrl,
                      url: f.url,
                      icon: f.icon,
                      description: f.description,
                      lastSyncAt: f.lastSyncAt,
                      tags: f.tags,
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (action === 'list_tags') {
          const tags = await getAllTags(userId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    count: tags.length,
                    tags: tags.map((t) => ({
                      id: t.id,
                      name: t.name,
                      color: t.color,
                    })),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (action === 'discover') {
          if (!url) {
            return {
              content: [
                { type: 'text' as const, text: 'Error: url is required for discover action' },
              ],
              isError: true,
            };
          }
          const discovered = await discoverRssFeeds(url);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ count: discovered.length, feeds: discovered }, null, 2),
              },
            ],
          };
        }

        return {
          content: [{ type: 'text' as const, text: `Error: Unknown action "${action}"` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ─── MANAGE FEEDS ───────────────────────────────────────────────
  server.tool(
    'manage_feeds',
    `Manage feed subscriptions and tags. Subscribe to new feeds, unsubscribe, update feed metadata, and create/update/delete tags.`,
    {
      action: z
        .enum(['subscribe', 'unsubscribe', 'update_feed', 'create_tag', 'update_tag', 'delete_tag'])
        .describe('Action to perform'),
      // For subscribe
      url: z.string().optional().describe('URL to subscribe to (required for subscribe)'),
      // For unsubscribe, update_feed
      feedId: z.string().optional().describe('Feed ID (required for unsubscribe, update_feed)'),
      // For update_feed
      title: z.string().optional().describe('New feed title'),
      description: z.string().optional().describe('New feed description'),
      tagIds: z
        .array(z.string())
        .optional()
        .describe('Tag IDs to assign to feed (replaces existing)'),
      // For create_tag, update_tag, delete_tag
      tagId: z.string().optional().describe('Tag ID (required for update_tag, delete_tag)'),
      tagName: z
        .string()
        .optional()
        .describe('Tag name (required for create_tag, optional for update_tag)'),
      tagColor: z
        .string()
        .nullable()
        .optional()
        .describe(
          'Tag color: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, or null',
        ),
    },
    async (
      { action, url, feedId, title, description, tagIds, tagId, tagName, tagColor },
      extra,
    ) => {
      const userId = extra.authInfo?.extra?.userId as string;
      if (!userId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not authenticated' }],
          isError: true,
        };
      }

      try {
        if (action === 'subscribe') {
          if (!url) {
            return {
              content: [{ type: 'text' as const, text: 'Error: url is required for subscribe' }],
              isError: true,
            };
          }
          const feed = await createFeed({ url }, userId);
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ success: true, feed }, null, 2) },
            ],
          };
        }

        if (action === 'unsubscribe') {
          if (!feedId) {
            return {
              content: [
                { type: 'text' as const, text: 'Error: feedId is required for unsubscribe' },
              ],
              isError: true,
            };
          }
          await deleteFeed(feedId, userId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true }, null, 2) }],
          };
        }

        if (action === 'update_feed') {
          if (!feedId) {
            return {
              content: [
                { type: 'text' as const, text: 'Error: feedId is required for update_feed' },
              ],
              isError: true,
            };
          }
          const updated = await updateFeed(
            feedId,
            {
              ...(title !== undefined && { title }),
              ...(description !== undefined && { description }),
              ...(tagIds !== undefined && { tags: tagIds }),
            },
            userId,
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ success: true, feed: updated }, null, 2),
              },
            ],
          };
        }

        if (action === 'create_tag') {
          if (!tagName) {
            return {
              content: [
                { type: 'text' as const, text: 'Error: tagName is required for create_tag' },
              ],
              isError: true,
            };
          }
          const tag = await createTag(
            { name: tagName, ...(tagColor !== undefined && { color: tagColor as any }) },
            userId,
          );
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ success: true, tag }, null, 2) },
            ],
          };
        }

        if (action === 'update_tag') {
          if (!tagId) {
            return {
              content: [{ type: 'text' as const, text: 'Error: tagId is required for update_tag' }],
              isError: true,
            };
          }
          const updated = await updateTag(
            tagId,
            {
              ...(tagName !== undefined && { name: tagName }),
              ...(tagColor !== undefined && { color: tagColor as any }),
            },
            userId,
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ success: true, tag: updated }, null, 2),
              },
            ],
          };
        }

        if (action === 'delete_tag') {
          if (!tagId) {
            return {
              content: [{ type: 'text' as const, text: 'Error: tagId is required for delete_tag' }],
              isError: true,
            };
          }
          await deleteTag(tagId, userId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true }, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: `Error: Unknown action "${action}"` }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
