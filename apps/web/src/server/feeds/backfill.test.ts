/**
 * The backfill against a real database.
 *
 * The property that matters is IDEMPOTENCE. Inserts are
 * `onConflictDoNothing`, so an existing row is never updated by a re-fetch —
 * which is what makes this necessary — and it runs on every boot, which is
 * what makes a second pass finding nothing to do the thing worth asserting.
 */
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL = 'memory://';

const { db } = await import('../db');
const { articles, feeds } = await import('../db/schema');
const { backfillArticleMetadata, countUnenrichedArticles } = await import(
  './backfill'
);

let feedId = 0;

beforeEach(async () => {
  await db.delete(articles);
  await db.delete(feeds);
  const [feed] = await db
    .insert(feeds)
    .values({ feedUrl: 'https://a.example/f', title: 'Alpha' })
    .returning();
  feedId = feed.id;
});

/** A row as it existed before the media columns — excerpt NULL. */
const legacy = (over: Record<string, unknown>) => ({
  feedId,
  guid: String(over.guid ?? 'g1'),
  title: 'A title',
  ...over,
});

describe('backfillArticleMetadata', () => {
  it('derives an excerpt from stored summary HTML', async () => {
    await db.insert(articles).values(
      legacy({
        guid: 'g1',
        summary: '<p>The body. The post X appeared first on Y.</p>',
        url: 'https://example.com/post',
      }),
    );

    await backfillArticleMetadata();

    const [row] = await db.select().from(articles);
    expect(row.excerpt).toBe('The body.');
  });

  it('recovers an image from the body, resolved against the article link', async () => {
    await db.insert(articles).values(
      legacy({
        guid: 'g2',
        url: 'https://example.com/posts/one',
        summary: '<p>Words</p><img src="/hero.jpg">',
      }),
    );

    await backfillArticleMetadata();

    const [row] = await db.select().from(articles);
    expect(row.imageUrl).toBe('https://example.com/hero.jpg');
  });

  it('reclassifies a stored YouTube link as video, with its thumbnail', async () => {
    await db.insert(articles).values(
      legacy({
        guid: 'g3',
        url: 'https://www.youtube.com/watch?v=Qtl8lJwbd4g',
        summary: 'Sponsor copy, timestamps, and a wall of links.',
      }),
    );

    await backfillArticleMetadata();

    const [row] = await db.select().from(articles);
    expect(row.kind).toBe('video');
    expect(row.imageUrl).toBe('https://i.ytimg.com/vi/Qtl8lJwbd4g/hqdefault.jpg');
    // A video row renders no preview, so none is stored.
    expect(row.excerpt).toBe('');
  });

  it('never downgrades a kind another pass already decided', async () => {
    await db.insert(articles).values(
      legacy({
        guid: 'g4',
        kind: 'short',
        url: 'https://www.youtube.com/shorts/5mU6SRS2Bxo',
      }),
    );

    await backfillArticleMetadata();

    const [row] = await db.select().from(articles);
    expect(row.kind).toBe('short');
  });

  it('writes "" rather than NULL when there is nothing to derive', async () => {
    // The marker contract: NULL means never enriched, '' means no excerpt.
    // Without it this scan would revisit the same rows on every boot.
    await db.insert(articles).values(legacy({ guid: 'g5' }));

    await backfillArticleMetadata();

    const [row] = await db.select().from(articles);
    expect(row.excerpt).toBe('');
  });

  it('is idempotent — a second pass has nothing left to do', async () => {
    await db
      .insert(articles)
      .values([
        legacy({ guid: 'g6', summary: '<p>One.</p>' }),
        legacy({ guid: 'g7' }),
      ]);

    expect(await countUnenrichedArticles()).toBe(2);
    expect(await backfillArticleMetadata()).toBe(2);

    expect(await countUnenrichedArticles()).toBe(0);
    expect(await backfillArticleMetadata()).toBe(0);
  });
});
