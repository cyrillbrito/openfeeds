import { $$applyFilterRules } from './actions.server';
import { articlesCollection } from './articles';

/**
 * Apply filter rules to existing articles in a feed
 * This marks articles as read based on the configured rules
 */
export async function applyFilterRules(
  feedId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  const result = await $$applyFilterRules({ data: { feedId } });

  // Refetch articles to reflect the updated read status
  articlesCollection.utils.refetch();

  return result;
}
