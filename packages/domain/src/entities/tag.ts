import { db, tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { ConflictError } from '../errors';
import type { CreateTag, Tag, UpdateTag } from './tag.schema';

// Re-export schemas and types from schema file
export * from './tag.schema';

export async function createTags(data: CreateTag[], userId: string): Promise<Tag[]> {
  if (data.length === 0) return [];

  // Batch case-insensitive duplicate check
  const lowerNames = data.map((d) => d.name.toLowerCase());
  const existing = await db
    .select({ name: tags.name })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, lowerNames)));

  if (existing.length > 0) {
    throw new ConflictError('Tag name already exists');
  }

  const values = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    name: item.name,
    color: item.color ?? null,
  }));

  const inserted = await db.insert(tags).values(values).returning();

  for (const tag of inserted) {
    trackEvent(userId, 'tags:tag_create', {
      tag_id: tag.id,
      color: tag.color ?? 'default',
    });
  }

  return inserted.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    color: t.color as Tag['color'],
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function updateTags(
  data: (UpdateTag & { id: string })[],
  userId: string,
): Promise<void> {
  if (data.length === 0) return;

  await db.transaction(async (tx) => {
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

      const updateData: { name?: string; color?: string | null } = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.color !== undefined) updateData.color = updates.color;

      if (Object.keys(updateData).length > 0) {
        await tx
          .update(tags)
          .set(updateData)
          .where(and(eq(tags.id, id), eq(tags.userId, userId)));
      }
    }
  });
}

export async function deleteTags(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;

  await db.delete(tags).where(and(inArray(tags.id, ids), eq(tags.userId, userId)));

  for (const id of ids) {
    trackEvent(userId, 'tags:tag_delete', { tag_id: id });
  }
}
