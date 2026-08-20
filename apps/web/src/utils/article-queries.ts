import type { Article } from '@repo/domain/client';
import { type Ref, eq, inArray, or } from '@tanstack/react-db';
import type { ReadStatus } from '~/components/articles/ReadStatusToggle';

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

/**
 * Simple read-status where clause (no session tracking) for one-shot snapshot
 * queries. Returns null for 'all' (no filter).
 */
export function readStatusWhere(readStatus: ReadStatus): ((article: Ref<Article>) => any) | null {
  if (readStatus === 'read') return (article) => eq(article.isRead, true);
  if (readStatus === 'unread') return (article) => eq(article.isRead, false);
  return null;
}
