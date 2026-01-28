import { feeds, getDb } from '@repo/db';
import { eq } from 'drizzle-orm';
import { generateOpml } from 'feedsmith';

/**
 * Exports all user feeds as OPML 2.0 format.
 * Categories are comma-separated per OPML spec when feeds have multiple tags.
 */
export async function exportOpmlFeeds(userId: string): Promise<string> {
  const db = getDb();
  const allFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
    with: {
      feedTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  const outlines = allFeeds.map((feed) => ({
    text: feed.title,
    title: feed.title,
    xmlUrl: feed.feedUrl,
    htmlUrl: feed.url,
    type: 'rss',
    // Join tags with comma per OPML 2.0 spec
    category:
      feed.feedTags.length > 0 ? feed.feedTags.map((ft) => ft.tag.name).join(',') : undefined,
  }));

  return generateOpml({
    head: {
      title: 'OpenFeeds Export',
      dateCreated: new Date(),
    },
    body: {
      outlines,
    },
  });
}
