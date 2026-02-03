import { $$applyFilterRules } from './actions.server';

/**
 * Apply filter rules to existing articles in a feed
 * This marks articles as read based on the configured rules
 */
export async function applyFilterRules(
  feedId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  return await $$applyFilterRules({ data: { feedId } });
}
