import { db, tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, sql } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { assert, ConflictError, NotFoundError } from '../errors';
import type { CreateTag, UpdateTag } from './tag.schema';

// Re-export schemas and types from schema file
export * from './tag.schema';

/** Existence + ownership guard. Throws NotFoundError if tag doesn't exist or doesn't belong to user. */
async function assertTagExists(id: string, userId: string): Promise<void> {
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
    columns: { id: true },
  });

  if (!tag) {
    throw new NotFoundError();
  }
}

export async function createTag(data: CreateTag, userId: string): Promise<void> {
  // Check if tag name already exists for this user (case-insensitive)
  const existingTag = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${data.name})`),
  });

  if (existingTag) {
    throw new ConflictError('Tag name already exists');
  }

  const dbResult = await db
    .insert(tags)
    .values({
      id: data.id ?? createId(),
      userId,
      name: data.name,
      color: data.color,
    })
    .returning();

  const newTag = dbResult[0];
  assert(newTag, 'Created tag must exist');

  trackEvent(userId, 'tags:tag_create', {
    tag_id: newTag.id,
    color: newTag.color ?? 'default',
  });
}

export async function updateTag(id: string, data: UpdateTag, userId: string): Promise<void> {
  // Verify tag exists and belongs to user
  await assertTagExists(id, userId);

  // Check if new name already exists for this user (excluding current tag) - case-insensitive
  if (data.name) {
    const duplicateTag = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${data.name})`),
    });

    if (duplicateTag && duplicateTag.id !== id) {
      throw new ConflictError('Tag name already exists');
    }
  }

  // Build update object with only provided fields
  const updateData: { name?: string; color?: string | null } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;

  await db
    .update(tags)
    .set(updateData)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)));
}

export async function deleteTag(id: string, userId: string): Promise<void> {
  // Verify tag exists and belongs to user
  await assertTagExists(id, userId);

  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));

  trackEvent(userId, 'tags:tag_delete', { tag_id: id });
}
