// The read layer against a real database. Two users throughout, because with
// global `feeds` and `articles` the only thing keeping them apart is a join
// this layer is responsible for writing.
//
// The unread-count test guards a real bug: as a correlated subquery Drizzle
// emitted unqualified columns, so every feed reported exactly 1 unread.
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL = 'memory://';

const { db } = await import('../db');
const { articles, articleState, feeds, subscriptions, user } = await import(
  '../db/schema'
);
const {
  countUnread,
  countUnreadShorts,
  getFeed,
  listArticles,
  listFeeds,
  markAllRead,
  setArticleRead,
} = await import('./queries');

const ALICE = 'user_alice';
const BOB = 'user_bob';

let feedA = 0;
let feedB = 0;

beforeEach(async () => {
  await db.delete(articleState);
  await db.delete(subscriptions);
  await db.delete(articles);
  await db.delete(feeds);
  await db.delete(user);

  await db.insert(user).values([
    { id: ALICE, name: 'Alice', email: 'alice@example.com' },
    { id: BOB, name: 'Bob', email: 'bob@example.com' },
  ]);

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

  // Alice follows both; Bob follows only Beta.
  await db.insert(subscriptions).values([
    { userId: ALICE, feedId: feedA },
    { userId: ALICE, feedId: feedB },
    { userId: BOB, feedId: feedB },
  ]);

  await db.insert(articles).values([
    { feedId: feedA, guid: 'a1', title: 'A1', publishedAt: new Date(3) },
    { feedId: feedA, guid: 'a2', title: 'A2', publishedAt: new Date(2) },
    { feedId: feedA, guid: 'a3', title: 'A3', publishedAt: new Date(1) },
    { feedId: feedB, guid: 'b1', title: 'B1', publishedAt: new Date(4) },
  ]);
});

describe('listFeeds', () => {
  it('counts every unread article per feed, not just one', async () => {
    const rows = await listFeeds(ALICE);
    expect(rows.map((r) => [r.title, r.unreadCount])).toEqual([
      ['Alpha', 3],
      ['Beta', 1],
    ]);
  });

  it('returns only the feeds the user subscribes to', async () => {
    expect((await listFeeds(BOB)).map((r) => r.title)).toEqual(['Beta']);
  });

  it('excludes read articles from the count', async () => {
    const [first] = await db.select().from(articles);
    await setArticleRead(ALICE, first.id, true);

    const alpha = (await listFeeds(ALICE)).find((f) => f.title === 'Alpha')!;
    expect(alpha.unreadCount).toBe(2);
  });

  it('keeps a feed with no articles at all, at zero', async () => {
    await db.delete(articleState);
    await db.delete(articles);
    const rows = await listFeeds(ALICE);
    // LEFT join, not inner: a brand-new feed must still appear in the sidebar.
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.unreadCount === 0)).toBe(true);
  });
});

describe('getFeed', () => {
  it('returns nothing for a feed the user does not follow', async () => {
    expect(await getFeed(ALICE, feedA)).not.toBeNull();
    expect(await getFeed(BOB, feedA)).toBeNull();
  });
});

describe('listArticles', () => {
  it('returns newest first, across all feeds', async () => {
    const items = await listArticles(ALICE);
    expect(items.map((i) => i.title)).toEqual(['B1', 'A1', 'A2', 'A3']);
  });

  it('returns only articles from feeds the user follows', async () => {
    expect((await listArticles(BOB)).map((i) => i.title)).toEqual(['B1']);
  });

  it('filters to one feed', async () => {
    const items = await listArticles(ALICE, { feedId: feedB });
    expect(items.map((i) => i.title)).toEqual(['B1']);
  });

  it('hides read articles when asked', async () => {
    const [newest] = await listArticles(ALICE);
    await setArticleRead(ALICE, newest.id, true);

    expect(
      (await listArticles(ALICE, { unreadOnly: true })).map((i) => i.title),
    ).toEqual(['A1', 'A2', 'A3']);
    // Not unreadOnly: the read article is still listed.
    expect(await listArticles(ALICE)).toHaveLength(4);
  });

  it('keeps read state per user on a shared article', async () => {
    const [b1] = await listArticles(BOB);
    await setArticleRead(BOB, b1.id, true);

    expect((await listArticles(BOB))[0].isRead).toBe(true);
    // Same article, Alice's copy of the state: untouched.
    expect((await listArticles(ALICE))[0].isRead).toBe(false);
    expect(await countUnread(ALICE)).toBe(4);
    expect(await countUnread(BOB)).toBe(0);
  });

  it('joins the feed title for display', async () => {
    const items = await listArticles(ALICE, { feedId: feedA });
    expect(items[0].feedTitle).toBe('Alpha');
  });
});

describe('markAllRead', () => {
  it('scopes to one feed when given one', async () => {
    await markAllRead(ALICE, { feedId: feedA });
    expect(await countUnread(ALICE)).toBe(1);
    expect(
      (await listFeeds(ALICE)).find((f) => f.title === 'Beta')!.unreadCount,
    ).toBe(1);
  });

  it('clears everything when given nothing', async () => {
    await markAllRead(ALICE);
    expect(await countUnread(ALICE)).toBe(0);
  });

  it('leaves the other user unread', async () => {
    await markAllRead(ALICE);
    expect(await countUnread(BOB)).toBe(1);
  });

  it('is repeatable — the second run updates rather than conflicts', async () => {
    await markAllRead(ALICE);
    await markAllRead(ALICE);
    expect(await countUnread(ALICE)).toBe(0);
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
    const items = await listArticles(ALICE, { shorts: 'exclude' });
    expect(items.map((i) => i.title)).toEqual(['B1', 'A1', 'A2', 'A3']);
  });

  it('returns only shorts for the queue, newest first', async () => {
    const items = await listArticles(ALICE, { shorts: 'only' });
    expect(items.map((i) => i.title)).toEqual(['S2', 'S1']);
  });

  it('still shows them on their own feed page', async () => {
    const items = await listArticles(ALICE, { feedId: feedB });
    expect(items.map((i) => i.title)).toEqual(['S2', 'S1', 'B1']);
  });

  it('counts each badge against the list it sits over', async () => {
    expect(await countUnread(ALICE)).toBe(4);
    expect(await countUnreadShorts(ALICE)).toBe(2);
  });

  it('leaves the shorts queue alone when the inbox is marked read', async () => {
    await markAllRead(ALICE, { shorts: 'exclude' });
    expect(await countUnread(ALICE)).toBe(0);
    expect(await countUnreadShorts(ALICE)).toBe(2);
  });
});
