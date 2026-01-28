import { articles, getDb } from '@repo/db';
import { attemptAsyncFn, startTimer } from '@repo/shared/utils';
import { and, eq, lt } from 'drizzle-orm';
import { logToFile, logToFileDump } from './logger-file';
import { getAutoArchiveCutoffDate } from './settings';

export interface ArchiveResult {
  markedCount: number;
  cutoffDate: string;
}

export async function autoArchiveArticles(userId: string): Promise<void> {
  const [error] = await attemptAsyncFn(async () => {
    const timer = startTimer();
    const result = await performArchiveArticles(userId);

    console.log(
      `Auto-archived ${result.markedCount} articles in ${timer.elapsed().toFixed(2)} seconds`,
    );

    // Log to file for tracking
    await logToFile(
      'auto-archive',
      `Archived ${result.markedCount} articles (before ${result.cutoffDate})`,
    );
  });

  if (error) {
    console.error('Error in autoArchiveArticles:', error);
    await logToFileDump('auto-archive', error);
  }
}

export async function performArchiveArticles(userId: string): Promise<ArchiveResult> {
  const db = getDb();
  // Get the cutoff date for auto-archiving articles
  const cutoffDate = await getAutoArchiveCutoffDate(userId);

  // Archive articles that are older than the cutoff date, unread, and not already archived
  const result = await db
    .update(articles)
    .set({ isArchived: true })
    .where(
      and(
        eq(articles.userId, userId),
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
