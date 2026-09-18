/**
 * The read layer against a real database.
 *
 * The unread-count test exists because of a bug this suite caught in the
 * browser and not in code review: written as a correlated subquery, Drizzle
 * emitted UNQUALIFIED column names, so the subquery's `"id"` bound to
 * articles.id instead of feeds.id and every feed reported exactly 1 unread.
 * Numbers that are plausible-but-wrong are the ones that ship.
 */
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_PATH = ':memory:';

const { db } = await import('../db');
const { articles, feeds } = await import('../db/schema');
const {
  countUnread,
  countUnreadShorts,
  listArticles,
  listFeeds,
  markAllRead,
  setArticleArchived,
  setArticleRead,
} = await import('./queries');

let feedA = 0;
let feedB = 0;

beforeEach(async () => {
  await db.delete(articles);
  await db.delete(feeds);

  const [a] = await db
    .insert(feeds)
    .values({ feedUrl: 'https://a.example/f', title: 'Alpha' })
    .returning();
  const [b] = await db
    .insert(feeds)
    .values({ feedUrl: 'https://b.example/f', title: 'Beta' })
    .returning();
  feedA = a.id;
  feedB = b.id;

  await db.insert(articles).values([
    { feedId: feedA, guid: 'a1', title: 'A1', publishedAt: new Date(3) },
    { feedId: feedA, guid: 'a2', title: 'A2', publishedAt: new Date(2) },
    { feedId: feedA, guid: 'a3', title: 'A3', publishedAt: new Date(1) },
    { feedId: feedB, guid: 'b1', title: 'B1', publishedAt: new Date(4) },
  ]);
});

describe('listFeeds', () => {
  it('counts every unread article per feed, not just one', async () => {
    const rows = await listFeeds();
    expect(rows.map((r) => [r.title, r.unreadCount])).toEqual([
      ['Alpha', 3],
      ['Beta', 1],
    ]);
  });

  it('excludes read and archived articles from the count', async () => {
    const [first] = await db.select().from(articles);
    await setArticleRead(first.id, true);

    const alpha = (await listFeeds()).find((f) => f.title === 'Alpha')!;
    expect(alpha.unreadCount).toBe(2);

    const [second] = (await db.select().from(articles)).filter(
      (a) => a.id !== first.id && a.feedId === feedA,
    );
    await setArticleArchived(second.id, true);
    expect((await listFeeds()).find((f) => f.title === 'Alpha')!.unreadCount).toBe(1);
  });

  it('keeps a feed with no articles at all, at zero', async () => {
    await db.delete(articles);
    const rows = await listFeeds();
    // LEFT join, not inner: a brand-new feed must still appear in the sidebar.
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.unreadCount === 0)).toBe(true);
  });
});

describe('listArticles', () => {
  it('returns newest first, across all feeds', async () => {
    const items = await listArticles();
    expect(items.map((i) => i.title)).toEqual(['B1', 'A1', 'A2', 'A3']);
  });

  it('filters to one feed', async () => {
    const items = await listArticles({ feedId: feedB });
    expect(items.map((i) => i.title)).toEqual(['B1']);
  });

  it('hides read articles when asked, and archived ones always', async () => {
    const [newest] = await listArticles();
    await setArticleRead(newest.id, true);

    expect((await listArticles({ unreadOnly: true })).map((i) => i.title)).toEqual([
      'A1',
      'A2',
      'A3',
    ]);
    // Not unreadOnly: the read article is still listed.
    expect(await listArticles()).toHaveLength(4);

    await setArticleArchived(newest.id, true);
    expect(await listArticles()).toHaveLength(3);
  });

  it('joins the feed title for display', async () => {
    const items = await listArticles({ feedId: feedA });
    expect(items[0].feedTitle).toBe('Alpha');
  });
});

describe('markAllRead', () => {
  it('scopes to one feed when given one', async () => {
    await markAllRead({ feedId: feedA });
    expect(await countUnread()).toBe(1);
    expect((await listFeeds()).find((f) => f.title === 'Beta')!.unreadCount).toBe(1);
  });

  it('clears everything when given nothing', async () => {
    await markAllRead();
    expect(await countUnread()).toBe(0);
  });
});

/**
 * The shorts split. Both halves of the table are queried by two different
 * screens, so the thing worth pinning down is that neither leaks into the
 * other — an inbox that shows a short, or a count that includes one, is the
 * failure this filter exists to prevent.
 */
describe('shorts', () => {
  beforeEach(async () => {
    await db.insert(articles).values([
      {
        feedId: feedB,
        guid: 's1',
        title: 'S1',
        url: 'https://www.youtube.com/shorts/5mU6SRS2Bxo',
        kind: 'short',
        publishedAt: new Date(5),
      },
      {
        feedId: feedB,
        guid: 's2',
        title: 'S2',
        url: 'https://www.youtube.com/shorts/LiH-P4rSkLI',
        kind: 'short',
        publishedAt: new Date(6),
      },
    ]);
  });

  it('keeps shorts out of the inbox', async () => {
    const items = await listArticles({ shorts: 'exclude' });
    expect(items.map((i) => i.title)).toEqual(['B1', 'A1', 'A2', 'A3']);
  });

  it('returns only shorts for the queue, newest first', async () => {
    const items = await listArticles({ shorts: 'only' });
    expect(items.map((i) => i.title)).toEqual(['S2', 'S1']);
  });

  it('still shows them on their own feed page', async () => {
    const items = await listArticles({ feedId: feedB });
    expect(items.map((i) => i.title)).toEqual(['S2', 'S1', 'B1']);
  });

  it('counts each badge against the list it sits over', async () => {
    expect(await countUnread()).toBe(4);
    expect(await countUnreadShorts()).toBe(2);
  });

  it('leaves the shorts queue alone when the inbox is marked read', async () => {
    await markAllRead({ shorts: 'exclude' });
    expect(await countUnread()).toBe(0);
    expect(await countUnreadShorts()).toBe(2);
  });
});
