import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createArticle, extractArticleContent, getArticleById, updateArticles } from '@repo/domain';
import { z } from 'zod';
import { addTagsToArticles, removeTagsFromArticles, textResult } from './helpers';

/**
 * MCP tool: manage_articles
 *
 * Mark articles as read/unread, archive/unarchive, add/remove tags,
 * extract clean content, or save a URL as a new article.
 */
export function registerManageArticles(server: McpServer, userId: string) {
  server.registerTool(
    'manage_articles',
    {
      description:
        'Manage articles: mark read/unread, archive/unarchive, add/remove tags, extract readable content, or save a URL as a new article. ' +
        'Supports bulk operations. Tags are referenced by name and auto-created if new.',
      inputSchema: {
        actions: z
          .array(
            z.discriminatedUnion('action', [
              z.object({
                action: z.literal('update'),
                ids: z.array(z.string()).describe('Article IDs to update (from list_articles).'),
                is_read: z.boolean().optional().describe('Set read status.'),
                is_archived: z.boolean().optional().describe('Set archived status.'),
                add_tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to add. Auto-created if new.'),
                remove_tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to remove from these articles.'),
              }),
              z.object({
                action: z.literal('extract_content'),
                id: z
                  .string()
                  .describe(
                    'Article ID. Extracts a clean, readable version of the article content. Rate limited.',
                  ),
              }),
              z.object({
                action: z.literal('get_full'),
                id: z
                  .string()
                  .describe(
                    'Article ID. Returns the full article including content and clean content if available.',
                  ),
              }),
              z.object({
                action: z.literal('save_url'),
                url: z
                  .string()
                  .url()
                  .describe(
                    'Save a URL as a new article (not from an RSS feed). Content is auto-extracted.',
                  ),
                tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to assign to the saved article. Auto-created if new.'),
              }),
            ]),
          )
          .describe('List of article operations to perform.'),
      },
    },
    async ({ actions }) => {
      const results: { action: string; status: string; detail?: string; data?: unknown }[] = [];

      try {
        for (const op of actions) {
          switch (op.action) {
            case 'update': {
              const updateData: { id: string; isRead?: boolean; isArchived?: boolean }[] =
                op.ids.map((id) => ({
                  id,
                  ...(op.is_read !== undefined ? { isRead: op.is_read } : {}),
                  ...(op.is_archived !== undefined ? { isArchived: op.is_archived } : {}),
                }));

              if (op.is_read !== undefined || op.is_archived !== undefined) {
                await updateArticles(updateData, userId);
              }
              if (op.add_tags && op.add_tags.length > 0) {
                await addTagsToArticles(op.ids, op.add_tags, userId);
              }
              if (op.remove_tags && op.remove_tags.length > 0) {
                await removeTagsFromArticles(op.ids, op.remove_tags, userId);
              }

              const parts: string[] = [];
              if (op.is_read !== undefined) parts.push(`marked ${op.is_read ? 'read' : 'unread'}`);
              if (op.is_archived !== undefined)
                parts.push(`${op.is_archived ? 'archived' : 'unarchived'}`);
              if (op.add_tags?.length) parts.push(`added tags: ${op.add_tags.join(', ')}`);
              if (op.remove_tags?.length) parts.push(`removed tags: ${op.remove_tags.join(', ')}`);

              results.push({
                action: 'update',
                status: 'ok',
                detail: `Updated ${op.ids.length} article(s): ${parts.join('; ')}.`,
              });
              break;
            }
            case 'extract_content': {
              const content = await extractArticleContent(op.id, userId);
              results.push({
                action: 'extract_content',
                status: 'ok',
                detail: content
                  ? 'Content extracted successfully.'
                  : 'No extractable content (may be a video or content was already attempted).',
                data: content ? { cleanContent: content.substring(0, 2000) } : null,
              });
              break;
            }
            case 'get_full': {
              const article = await getArticleById(op.id, userId);
              results.push({
                action: 'get_full',
                status: 'ok',
                data: {
                  id: article.id,
                  title: article.title,
                  url: article.url,
                  author: article.author,
                  description: article.description,
                  content: article.content?.substring(0, 5000) ?? null,
                  cleanContent: article.cleanContent?.substring(0, 5000) ?? null,
                  pubDate: article.pubDate,
                  isRead: article.isRead,
                  isArchived: article.isArchived,
                },
              });
              break;
            }
            case 'save_url': {
              const saved = await createArticle({ url: op.url }, userId);
              if (op.tags && op.tags.length > 0) {
                await addTagsToArticles([saved.id], op.tags, userId);
              }
              results.push({
                action: 'save_url',
                status: 'ok',
                detail: `Saved "${saved.title}" (id: ${saved.id}).`,
              });
              break;
            }
          }
        }

        return textResult({ results });
      } catch (error) {
        return textResult(
          {
            results,
            error: `manage_articles failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          true,
        );
      }
    },
  );
}
