import { articles } from '@repo/db';
import { startTimer } from '@repo/shared/utils';
import { and, eq, lt } from 'drizzle-orm';
import type { DomainContext } from './domain-context';
import { getAutoArchiveCutoffDate, type ArchiveResult } from './entities/settings';

/**
 * Auto-archive old unread articles for the current user.
 * Logs the result. Called from autoArchiveForAllUsers (worker).
 */
export async function autoArchiveArticles(ctx: DomainContext): Promise<void> {
  try {
    const timer = startTimer();
    const result = await performArchiveArticles(ctx);

    console.log(
      `Auto-archived ${result.markedCount} articles in ${timer.elapsed().toFixed(2)} seconds`,
    );
  } catch (error) {
    console.error('Error in autoArchiveArticles:', error);
  }
}

/**
 * Archive articles older than the user's cutoff date.
 */
export async function performArchiveArticles(ctx: DomainContext): Promise<ArchiveResult> {
  // Get the cutoff date for auto-archiving articles
  const cutoffDate = await getAutoArchiveCutoffDate(ctx.userId);

  // Archive articles that are older than the cutoff date, unread, and not already archived
  const result = await ctx.conn
    .update(articles)
    .set({ isArchived: true })
    .where(
      and(
        eq(articles.userId, ctx.userId),
        eq(articles.isRead, false),
        eq(articles.isArchived, false),
        lt(articles.pubDate, cutoffDate),
      ),
    )
    .returning({ id: articles.id });

  return {
    markedCount: result.length,
    cutoffDate: cutoffDate.toISOString(),
  };
}
