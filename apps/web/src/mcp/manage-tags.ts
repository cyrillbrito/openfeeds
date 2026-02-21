import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db, feeds, feedTags, tags } from '@repo/db';
import { deleteTags, updateTags } from '@repo/domain';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  addTagsToArticles,
  addTagsToFeeds,
  removeTagsFromArticles,
  removeTagsFromFeeds,
  resolveTagNames,
  textResult,
} from './helpers';

const TAG_COLORS = [
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
] as const;

/**
 * MCP tool: manage_tags
 *
 * Create, rename, delete, recolor tags, and bulk assign/unassign tags to feeds or articles.
 * Tags are always referenced by name, never by ID.
 */
export function registerManageTags(server: McpServer, userId: string) {
  server.registerTool(
    'manage_tags',
    {
      description:
        'Manage tags: create, rename, recolor, delete, and bulk assign/unassign tags to feeds or articles. ' +
        'Tags are always referenced by name (case-insensitive). New tags are auto-created when assigned. ' +
        'Available colors: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose.',
      inputSchema: {
        actions: z
          .array(
            z.discriminatedUnion('action', [
              z.object({
                action: z.literal('create'),
                name: z.string().describe('Tag name. Must be unique (case-insensitive).'),
                color: z
                  .enum(TAG_COLORS)
                  .nullable()
                  .optional()
                  .describe('Tag color. Omit for no color.'),
              }),
              z.object({
                action: z.literal('rename'),
                name: z.string().describe('Current tag name (case-insensitive lookup).'),
                new_name: z.string().describe('New tag name. Must be unique.'),
              }),
              z.object({
                action: z.literal('recolor'),
                name: z.string().describe('Tag name (case-insensitive lookup).'),
                color: z
                  .enum(TAG_COLORS)
                  .nullable()
                  .describe('New color, or null to remove color.'),
              }),
              z.object({
                action: z.literal('delete'),
                names: z
                  .array(z.string())
                  .describe(
                    'Tag names to delete. Removes the tags and all their feed/article associations.',
                  ),
              }),
              z.object({
                action: z.literal('assign'),
                tag: z.string().describe('Tag name to assign. Auto-created if it does not exist.'),
                feed_ids: z.array(z.string()).optional().describe('Feed IDs to add this tag to.'),
                article_ids: z
                  .array(z.string())
                  .optional()
                  .describe('Article IDs to add this tag to.'),
              }),
              z.object({
                action: z.literal('unassign'),
                tag: z.string().describe('Tag name to remove.'),
                feed_ids: z
                  .array(z.string())
                  .optional()
                  .describe('Feed IDs to remove this tag from.'),
                article_ids: z
                  .array(z.string())
                  .optional()
                  .describe('Article IDs to remove this tag from.'),
              }),
              z.object({
                action: z.literal('list'),
              }),
            ]),
          )
          .describe('List of tag operations to perform.'),
      },
    },
    async ({ actions }) => {
      const results: { action: string; status: string; detail?: string; data?: unknown }[] = [];

      try {
        for (const op of actions) {
          switch (op.action) {
            case 'create': {
              const tagMap = await resolveTagNames([op.name], userId);
              // Check if it already existed
              const existing = await db.query.tags.findFirst({
                where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${op.name})`),
              });

              if (existing && op.color !== undefined) {
                // Tag exists, update color
                await updateTags([{ id: existing.id, color: op.color }], userId);
                results.push({
                  action: 'create',
                  status: 'ok',
                  detail: `Tag "${op.name}" already exists, updated color.`,
                });
              } else if (existing) {
                results.push({
                  action: 'create',
                  status: 'ok',
                  detail: `Tag "${op.name}" already exists.`,
                });
              } else {
                // Tag was just created by resolveTagNames, update color if specified
                if (op.color) {
                  const tagId = tagMap.get(op.name.toLowerCase());
                  if (tagId) {
                    await updateTags([{ id: tagId, color: op.color }], userId);
                  }
                }
                results.push({
                  action: 'create',
                  status: 'ok',
                  detail: `Created tag "${op.name}"${op.color ? ` with color ${op.color}` : ''}.`,
                });
              }
              break;
            }
            case 'rename': {
              const existing = await db.query.tags.findFirst({
                where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${op.name})`),
              });

              if (!existing) {
                results.push({
                  action: 'rename',
                  status: 'error',
                  detail: `Tag "${op.name}" not found.`,
                });
                break;
              }

              await updateTags([{ id: existing.id, name: op.new_name }], userId);
              results.push({
                action: 'rename',
                status: 'ok',
                detail: `Renamed "${op.name}" to "${op.new_name}".`,
              });
              break;
            }
            case 'recolor': {
              const existing = await db.query.tags.findFirst({
                where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${op.name})`),
              });

              if (!existing) {
                results.push({
                  action: 'recolor',
                  status: 'error',
                  detail: `Tag "${op.name}" not found.`,
                });
                break;
              }

              await updateTags([{ id: existing.id, color: op.color }], userId);
              results.push({
                action: 'recolor',
                status: 'ok',
                detail: `Set color of "${op.name}" to ${op.color ?? 'none'}.`,
              });
              break;
            }
            case 'delete': {
              // Look up tag IDs by name
              const toDelete: string[] = [];
              const notFound: string[] = [];

              for (const name of op.names) {
                const existing = await db.query.tags.findFirst({
                  where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${name})`),
                });
                if (existing) {
                  toDelete.push(existing.id);
                } else {
                  notFound.push(name);
                }
              }

              if (toDelete.length > 0) {
                await deleteTags(toDelete, userId);
              }

              results.push({
                action: 'delete',
                status: 'ok',
                detail: `Deleted ${toDelete.length} tag(s).${notFound.length > 0 ? ` Not found: ${notFound.join(', ')}.` : ''}`,
              });
              break;
            }
            case 'assign': {
              if (op.feed_ids && op.feed_ids.length > 0) {
                await addTagsToFeeds(op.feed_ids, [op.tag], userId);
              }
              if (op.article_ids && op.article_ids.length > 0) {
                await addTagsToArticles(op.article_ids, [op.tag], userId);
              }
              results.push({
                action: 'assign',
                status: 'ok',
                detail: `Assigned tag "${op.tag}" to ${op.feed_ids?.length ?? 0} feed(s) and ${op.article_ids?.length ?? 0} article(s).`,
              });
              break;
            }
            case 'unassign': {
              if (op.feed_ids && op.feed_ids.length > 0) {
                await removeTagsFromFeeds(op.feed_ids, [op.tag], userId);
              }
              if (op.article_ids && op.article_ids.length > 0) {
                await removeTagsFromArticles(op.article_ids, [op.tag], userId);
              }
              results.push({
                action: 'unassign',
                status: 'ok',
                detail: `Removed tag "${op.tag}" from ${op.feed_ids?.length ?? 0} feed(s) and ${op.article_ids?.length ?? 0} article(s).`,
              });
              break;
            }
            case 'list': {
              const allTags = await db.query.tags.findMany({
                where: eq(tags.userId, userId),
              });

              // Fetch feed associations
              const feedTagRows = await db
                .select({
                  tagId: feedTags.tagId,
                  feedTitle: feeds.title,
                  feedUrl: feeds.url,
                })
                .from(feedTags)
                .innerJoin(feeds, eq(feedTags.feedId, feeds.id))
                .where(eq(feedTags.userId, userId));

              const tagFeedsMap = new Map<string, { title: string; url: string }[]>();
              for (const row of feedTagRows) {
                const existing = tagFeedsMap.get(row.tagId) ?? [];
                existing.push({ title: row.feedTitle, url: row.feedUrl });
                tagFeedsMap.set(row.tagId, existing);
              }

              const enrichedTags = allTags.map((t) => ({
                name: t.name,
                color: t.color,
                feeds: tagFeedsMap.get(t.id) ?? [],
              }));

              results.push({
                action: 'list',
                status: 'ok',
                data: { tags: enrichedTags },
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
            error: `manage_tags failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          true,
        );
      }
    },
  );
}
