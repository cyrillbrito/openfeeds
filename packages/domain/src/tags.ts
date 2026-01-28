import { getDb, tags } from '@repo/db';
import { type CreateTag, type Tag, type UpdateTag } from '@repo/shared/types';
import { attemptAsync, createId } from '@repo/shared/utils';
import { and, eq, sql } from 'drizzle-orm';
import { tagDbToApi } from './db-utils';
import { assert, ConflictError, NotFoundError, UnexpectedError } from './errors';

export async function getAllTags(userId: string): Promise<Tag[]> {
  const db = getDb();
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
  const db = getDb();
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
  });

  if (!tag) {
    throw new NotFoundError();
  }

  return tagDbToApi(tag);
}

export async function createTag(data: CreateTag & { id?: string }, userId: string): Promise<Tag> {
  const db = getDb();
  // Check if tag name already exists for this user (case-insensitive)
  const existingTag = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), sql`lower(${tags.name}) = lower(${data.name})`),
  });

  if (existingTag) {
    throw new ConflictError('Tag name already exists');
  }

  const [err, dbResult] = await attemptAsync(
    db
      .insert(tags)
      .values({
        id: data.id ?? createId(),
        userId,
        name: data.name,
        color: data.color,
      })
      .returning(),
  );

  if (err) {
    console.error('Database error creating tag:', err);
    throw new UnexpectedError();
  }

  const newTag = dbResult[0];
  assert(newTag, 'Created tag must exist');

  return tagDbToApi(newTag);
}

export async function updateTag(id: string, data: UpdateTag, userId: string): Promise<Tag> {
  const db = getDb();
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

  const [err, dbResult] = await attemptAsync(
    db
      .update(tags)
      .set(updateData)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning(),
  );

  if (err) {
    console.error('Database error updating tag:', err);
    throw new UnexpectedError();
  }

  const updatedTag = dbResult[0];
  assert(updatedTag, 'Updated tag must exist');

  return tagDbToApi(updatedTag);
}

export async function deleteTag(id: string, userId: string): Promise<void> {
  const db = getDb();
  // Verify tag exists and belongs to user
  await getTagById(id, userId);

  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
}
