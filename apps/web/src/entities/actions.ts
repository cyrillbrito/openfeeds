import type { MarkManyArchivedRequest, MarkManyArchivedResponse } from '@repo/shared/types';
import { useApi } from '../hooks/api';
import { articlesCollection } from './articles';
import { getErrorMessage } from './utils';

/**
 * Apply filter rules to existing articles in a feed
 * This marks articles as read based on the configured rules
 */
export async function applyFilterRules(
  feedId: number,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  const api = useApi();

  const { data, error } = await api.feeds({ id: feedId }).rules.apply.post();
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  // Refetch articles to reflect the updated read status
  articlesCollection.utils.refetch();

  return data;
}

/**
 * Mark many articles as archived based on context
 * Can archive all articles, articles in a feed, or articles in a tag
 */
export async function markManyArchived(
  request: MarkManyArchivedRequest,
): Promise<MarkManyArchivedResponse> {
  const api = useApi();

  const { data, error } = await api.articles['mark-many-archived'].post(request);
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  // Refetch articles to reflect the archived status
  articlesCollection.utils.refetch();

  return data;
}
