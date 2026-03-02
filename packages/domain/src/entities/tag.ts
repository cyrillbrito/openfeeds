import { tags, type Db, type Transaction } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { trackEvent } from '../analytics';
import { ConflictError } from '../errors';
import type { CreateTag, ReorderTagsSchema, Tag, UpdateTag } from './tag.schema';

// Re-export schemas and types from schema file
export * from './tag.schema';

export async function createTags(
  data: CreateTag[],
  userId: string,
  conn: Db | Transaction,
): Promise<Tag[]> {
  if (data.length === 0) return [];

  const values = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    name: item.name,
    color: item.color ?? null,
    ...(item.order !== undefined ? { order: item.order } : {}),
  }));

  // NOTE: Duplicates are silently skipped via ON CONFLICT DO NOTHING (case-insensitive
  // unique index on [userId, name]). The client already prevents creating tags with
  // duplicate names, so conflicts here are a race-condition safety net. We may want to
  // revisit this and surface skipped tags to the caller if it causes confusion.
  const inserted = await conn.insert(tags).values(values).onConflictDoNothing().returning();

  for (const tag of inserted) {
    trackEvent(userId, 'tags:tag_create', {
      tag_name: tag.name,
      color: tag.color ?? 'default',
    });
  }

  return inserted.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    color: t.color as Tag['color'],
    order: t.order,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function updateTags(
  data: UpdateTag[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (data.length === 0) return;

  await conn.transaction(async (tx) => {
    for (const { id, ...updates } of data) {
      // Check if new name already exists for this user (excluding current tag) - case-insensitive
      if (updates.name) {
        const duplicateTag = await tx.query.tags.findFirst({
          where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${updates.name})`),
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
        await tx
          .update(tags)
          .set(updateData)
          .where(and(eq(tags.id, id), eq(tags.userId, userId)));
      }
    }
  });
}

export async function deleteTags(
  ids: string[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (ids.length === 0) return;

  await conn.delete(tags).where(and(inArray(tags.id, ids), eq(tags.userId, userId)));

  trackEvent(userId, 'tags:tag_delete', { count: ids.length });
}

export async function reorderTags(
  data: z.infer<typeof ReorderTagsSchema>,
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (data.length === 0) return;

  // Bulk update order values in a single query using CASE
  const cases = data.map((item) => sql`WHEN ${item.id}::uuid THEN ${item.order}`);

  await conn
    .update(tags)
    .set({
      order: sql`CASE ${tags.id} ${sql.join(cases, sql` `)} END`,
    })
    .where(
      and(
        eq(tags.userId, userId),
        inArray(
          tags.id,
          data.map((item) => item.id),
        ),
      ),
    );
}
