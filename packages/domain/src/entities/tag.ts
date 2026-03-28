import { tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import type { TransactionContext } from '../domain-context';
import { ConflictError } from '../errors';
import type { CreateTag, Tag, UpdateTag } from './tag.schema';

// Re-export schemas and types from schema file
export * from './tag.schema';

export async function createTags(ctx: TransactionContext, data: CreateTag[]): Promise<Tag[]> {
  if (data.length === 0) return [];

  // Determine the next order value for tags without an explicit order
  const needsAutoOrder = data.some((item) => item.order === undefined);
  let nextOrder = 0;

  if (needsAutoOrder) {
    const result = await ctx.conn
      .select({ maxOrder: sql<number>`coalesce(max(${tags.order}), -1)` })
      .from(tags)
      .where(eq(tags.userId, ctx.userId));
    nextOrder = (result[0]?.maxOrder ?? -1) + 1;
  }

  const values = data.map((item) => ({
    id: item.id ?? createId(),
    userId: ctx.userId,
    name: item.name,
    color: item.color ?? null,
    order: item.order ?? nextOrder++,
  }));

  // NOTE: Duplicates are silently skipped via ON CONFLICT DO NOTHING (case-insensitive
  // unique index on [userId, name]). The client already prevents creating tags with
  // duplicate names, so conflicts here are a race-condition safety net. We may want to
  // revisit this and surface skipped tags to the caller if it causes confusion.
  const inserted = await ctx.conn.insert(tags).values(values).onConflictDoNothing().returning();

  for (const tag of inserted) {
    trackEvent(ctx.userId, 'tags:tag_create', {
      tag_name: tag.name,
      color: tag.color ?? 'default',
    });
  }

  return inserted.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    color: t.color as Tag['color'],
    order: t.order,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function updateTags(ctx: TransactionContext, data: UpdateTag[]): Promise<void> {
  if (data.length === 0) return;

  for (const { id, ...updates } of data) {
    // Check if new name already exists for this user (excluding current tag) - case-insensitive
    if (updates.name) {
      const duplicateTag = await ctx.conn.query.tags.findFirst({
        where: and(eq(tags.userId, ctx.userId), sql`lower(${tags.name}) = lower(${updates.name})`),
      });

      if (duplicateTag && duplicateTag.id !== id) {
        throw new ConflictError('Tag name already exists');
      }
    }

    const updateData: { name?: string; color?: string | null; order?: number } = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.order !== undefined) updateData.order = updates.order;

    if (Object.keys(updateData).length > 0) {
      await ctx.conn
        .update(tags)
        .set(updateData)
        .where(and(eq(tags.id, id), eq(tags.userId, ctx.userId)));
    }
  }
}

export async function deleteTags(ctx: TransactionContext, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await ctx.conn.delete(tags).where(and(inArray(tags.id, ids), eq(tags.userId, ctx.userId)));

  trackEvent(ctx.userId, 'tags:tag_delete', { count: ids.length });
}
