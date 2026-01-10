import { tags, type UserDb } from '@repo/db';
import { type CreateTag, type Tag, type UpdateTag } from '@repo/shared/types';
import { attemptAsync, createId } from '@repo/shared/utils';
import { eq, sql } from 'drizzle-orm';
import { tagDbToApi } from './db-utils';
import { assert, ConflictError, NotFoundError, UnexpectedError } from './errors';

export async function getAllTags(db: UserDb): Promise<Tag[]> {
  const allTags = await db.query.tags.findMany();
  return allTags.map(tagDbToApi);
}

/**
 * Get tag by ID
 * Used for business logic that needs a single tag
 */
export async function getTagById(id: string, db: UserDb): Promise<Tag> {
  const tag = await db.query.tags.findFirst({
    where: eq(tags.id, id),
  });

  if (!tag) {
    throw new NotFoundError();
  }

  return tagDbToApi(tag);
}

export async function createTag(data: CreateTag & { id?: string }, db: UserDb): Promise<Tag> {
  // Check if tag name already exists (case-insensitive)
  const existingTag = await db.query.tags.findFirst({
    where: sql`lower(${tags.name}) = lower(${data.name})`,
  });

  if (existingTag) {
    throw new ConflictError('Tag name already exists');
  }

  const [err, dbResult] = await attemptAsync(
    db
      .insert(tags)
      .values({
        id: data.id ?? createId(),
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

export async function updateTag(id: string, data: UpdateTag, db: UserDb): Promise<Tag> {
  // Verify tag exists
  await getTagById(id, db);

  // Check if new name already exists (excluding current tag) - case-insensitive
  if (data.name) {
    const duplicateTag = await db.query.tags.findFirst({
      where: sql`lower(${tags.name}) = lower(${data.name})`,
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
    db.update(tags).set(updateData).where(eq(tags.id, id)).returning(),
  );

  if (err) {
    console.error('Database error updating tag:', err);
    throw new UnexpectedError();
  }

  const updatedTag = dbResult[0];
  assert(updatedTag, 'Updated tag must exist');

  return tagDbToApi(updatedTag);
}

export async function deleteTag(id: string, db: UserDb): Promise<void> {
  // Verify tag exists
  await getTagById(id, db);

  await db.delete(tags).where(eq(tags.id, id));
}
