import { type UserDb } from '@repo/db';
import { type ArticleTag } from '@repo/shared/types';

export async function getAllArticleTags(db: UserDb): Promise<ArticleTag[]> {
  return db.query.articleTags.findMany();
}
