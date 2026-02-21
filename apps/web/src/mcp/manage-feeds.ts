import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createFeeds, deleteFeeds, retryFeed, updateFeeds } from '@repo/domain';
import { z } from 'zod';
import { addTagsToFeeds, removeTagsFromFeeds, textResult } from './helpers';

/**
 * MCP tool: manage_feeds
 *
 * Add, update, or remove RSS feed subscriptions.
 * Supports bulk operations and tag management via add_tags/remove_tags.
 */
export function registerManageFeeds(server: McpServer, userId: string) {
  server.registerTool(
    'manage_feeds',
    {
      description:
        'Add, update, or remove RSS feed subscriptions. Supports bulk operations. ' +
        'Use add_tags/remove_tags to manage feed tags without replacing them all. ' +
        'Tags are referenced by name and auto-created if new.',
      inputSchema: {
        actions: z
          .array(
            z.discriminatedUnion('action', [
              z.object({
                action: z.literal('add'),
                url: z.string().url().describe('The website or RSS feed URL to subscribe to.'),
                tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to assign to the new feed. Tags are auto-created if new.'),
              }),
              z.object({
                action: z.literal('update'),
                id: z.string().describe('Feed ID (from list_feeds).'),
                title: z.string().optional().describe('New display title.'),
                description: z.string().nullable().optional().describe('New description.'),
                url: z.string().url().optional().describe('New website URL.'),
                add_tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to add. Auto-created if new.'),
                remove_tags: z
                  .array(z.string())
                  .optional()
                  .describe('Tag names to remove from this feed.'),
              }),
              z.object({
                action: z.literal('remove'),
                id: z.string().describe('Feed ID to remove. This deletes all its articles too.'),
              }),
              z.object({
                action: z.literal('retry'),
                id: z
                  .string()
                  .describe(
                    'Feed ID to retry syncing. Resets the error state so the next sync picks it up.',
                  ),
              }),
            ]),
          )
          .describe('List of feed operations to perform.'),
      },
    },
    async ({ actions }) => {
      const results: { action: string; status: string; detail?: string }[] = [];

      try {
        for (const op of actions) {
          switch (op.action) {
            case 'add': {
              const created = await createFeeds([{ url: op.url }], userId);
              const feed = created[0];
              if (feed && op.tags && op.tags.length > 0) {
                await addTagsToFeeds([feed.id], op.tags, userId);
              }
              results.push({
                action: 'add',
                status: 'ok',
                detail: `Subscribed to "${op.url}"${feed ? ` (id: ${feed.id})` : ''}. Feed details and articles will be fetched shortly.`,
              });
              break;
            }
            case 'update': {
              const updates: {
                id: string;
                title?: string;
                description?: string | null;
                url?: string;
              } = { id: op.id };
              if (op.title !== undefined) updates.title = op.title;
              if (op.description !== undefined) updates.description = op.description;
              if (op.url !== undefined) updates.url = op.url;

              if (Object.keys(updates).length > 1) {
                await updateFeeds([updates], userId);
              }
              if (op.add_tags && op.add_tags.length > 0) {
                await addTagsToFeeds([op.id], op.add_tags, userId);
              }
              if (op.remove_tags && op.remove_tags.length > 0) {
                await removeTagsFromFeeds([op.id], op.remove_tags, userId);
              }
              results.push({ action: 'update', status: 'ok', detail: `Updated feed ${op.id}.` });
              break;
            }
            case 'remove': {
              await deleteFeeds([op.id], userId);
              results.push({
                action: 'remove',
                status: 'ok',
                detail: `Removed feed ${op.id} and all its articles.`,
              });
              break;
            }
            case 'retry': {
              await retryFeed(op.id, userId);
              results.push({
                action: 'retry',
                status: 'ok',
                detail: `Reset sync error for feed ${op.id}. It will sync on the next cycle.`,
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
            error: `manage_feeds failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          true,
        );
      }
    },
  );
}
