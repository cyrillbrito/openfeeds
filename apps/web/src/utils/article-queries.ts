import type { Article } from '@repo/domain/client';
import type { Ref } from '@tanstack/db';
import { eq, inArray, or } from '@tanstack/solid-db';
import type { ReadStatus } from '~/components/ReadStatusToggle';

/**
 * Builds a read-status where clause that correctly handles session-read tracking.
 *
 * For 'unread': filters to unread articles + articles read in the current session
 * (so they don't vanish immediately). For 'read': filters to read articles only.
 *
 * Usage inside useLiveQuery:
 *   const filter = readStatusFilter(readStatus(), sessionReadIds());
 *   if (filter) {
 *     query = query.where(({ article }) => filter(article));
 *   }
 */
export function readStatusFilter(
  readStatus: ReadStatus,
  sessionReadIds: Set<string>,
): ((article: Ref<Article>) => any) | null {
  if (readStatus === 'read') {
    return (article) => eq(article.isRead, true);
  }

  if (readStatus === 'unread') {
    const ids = [...sessionReadIds];
    return (article) =>
      ids.length > 0
        ? or(eq(article.isRead, false), inArray(article.id, ids))
        : eq(article.isRead, false);
  }

  return null;
}
