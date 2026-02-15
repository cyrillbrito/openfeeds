import { db, tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, sql } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { tagDbToApi } from '../db-utils';
import { assert, ConflictError, NotFoundError, UnexpectedError } from '../errors';
import type { CreateTag, Tag, UpdateTag } from './tag.schema';

// Re-export schemas and types from schema file
export * from './tag.schema';

export async function getAllTags(userId: string): Promise<Tag[]> {
  const allTags = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
  });
  return allTags.map(tagDbToApi);
}

/**
 * Get tag by ID
 * Used for business logic that needs a single tag
 */
export async function getTagById(id: string, userId: string): Promise<Tag> {
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
  });

  if (!tag) {
    throw new NotFoundError();
  }

  return tagDbToApi(tag);
}

export async function createTag(data: CreateTag, userId: string): Promise<Tag> {
  // Check if tag name already exists for this user (case-insensitive)
  const existingTag = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${data.name})`),
  });

  if (existingTag) {
    throw new ConflictError('Tag name already exists');
  }

  let dbResult: (typeof tags.$inferSelect)[];
  try {
    dbResult = await db
      .insert(tags)
      .values({
        id: data.id ?? createId(),
        userId,
        name: data.name,
        color: data.color,
      })
      .returning();
  } catch (err) {
    console.error('Database error creating tag:', err);
    throw new UnexpectedError();
  }

  const newTag = dbResult[0];
  assert(newTag, 'Created tag must exist');

  trackEvent(userId, 'tags:tag_create', {
    tag_id: newTag.id,
    color: newTag.color ?? 'default',
  });

  return tagDbToApi(newTag);
}

export async function updateTag(id: string, data: UpdateTag, userId: string): Promise<Tag> {
  // Verify tag exists and belongs to user
  await getTagById(id, userId);

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

  let dbResult: (typeof tags.$inferSelect)[];
  try {
    dbResult = await db
      .update(tags)
      .set(updateData)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning();
  } catch (err) {
    console.error('Database error updating tag:', err);
    throw new UnexpectedError();
  }

  const updatedTag = dbResult[0];
  assert(updatedTag, 'Updated tag must exist');

  return tagDbToApi(updatedTag);
}

export async function deleteTag(id: string, userId: string): Promise<void> {
  // Verify tag exists and belongs to user
  await getTagById(id, userId);

  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));

  trackEvent(userId, 'tags:tag_delete', { tag_id: id });
}
