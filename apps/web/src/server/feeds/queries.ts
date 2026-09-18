// Reads. Kept apart from sync.ts so the write path (fetching, parsing,
// scheduling) and the read path (what the UI renders) stay separable.
import 'server-only';

import { and, count, desc, eq, ne, type SQL, sql } from 'drizzle-orm';

import { type ArticleKind } from '../../lib/article-kind';
import { db } from '../db';
import { articles, feeds } from '../db/schema';

/** How many articles a list page returns at once. */
const PAGE_SIZE = 50;

export interface FeedSummary {
  id: number;
  title: string;
  siteUrl: string | null;
  iconUrl: string | null;
  feedUrl: string;
  unreadCount: number;
  /** Present when the last fetch failed — the UI surfaces this. */
  lastError: string | null;
  failureCount: number;
  lastFetchedAt: Date | null;
}

/**
 * The sidebar: every feed with its unread count.
 *
 * A LEFT JOIN with a conditional count, NOT a correlated subquery. Drizzle
 * renders columns UNQUALIFIED when the statement has a single table in scope,
 * so `sql`(select count(*) from ${articles} where ${articles.feedId} =
 * ${feeds.id})`` emits `where "feed_id" = "id"` — and inside the subquery
 * `"id"` binds to articles.id, not feeds.id. That silently counts the rows
 * where an article's id happens to equal its feed's id: one row, so every
 * feed reported an unread count of 1.
 *
 * A join puts two tables in scope, which makes Drizzle qualify everything
 * (`"articles"."is_read"`, `"feeds"."id"`) and the correlation is then the
 * join condition itself. LEFT so a feed with no articles still appears.
 */
export async function listFeeds(): Promise<FeedSummary[]> {
  return db
    .select({
      id: feeds.id,
      title: feeds.title,
      siteUrl: feeds.siteUrl,
      iconUrl: feeds.iconUrl,
      feedUrl: feeds.feedUrl,
      lastError: feeds.lastError,
      failureCount: feeds.failureCount,
      lastFetchedAt: feeds.lastFetchedAt,
      unreadCount: sql<number>`count(case when ${articles.isRead} = 0 and ${articles.isArchived} = 0 then 1 end)`,
    })
    .from(feeds)
    .leftJoin(articles, eq(articles.feedId, feeds.id))
    .groupBy(feeds.id)
    .orderBy(feeds.title);
}

export async function getFeed(id: number) {
  const [feed] = await db.select().from(feeds).where(eq(feeds.id, id));
  return feed ?? null;
}

export interface ArticleListItem {
  id: number;
  title: string;
  url: string | null;
  author: string | null;
  /**
   * The derived preview — NOT the raw `summary`.
   *
   * The list used to select `summary` and strip its HTML in the browser,
   * which meant every inbox load serialised fifty full article bodies into
   * the SSR payload to render a hundred lines of text. The excerpt is
   * derived once at sync time instead (server/feeds/excerpt.ts), so the
   * bodies never leave the database.
   */
  excerpt: string | null;
  publishedAt: Date | null;
  isRead: boolean;
  kind: ArticleKind;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  durationSeconds: number | null;
  feedId: number;
  feedTitle: string;
  feedIconUrl: string | null;
}

export interface ArticleFilter {
  /** Restrict to one feed. Omit for the inbox. */
  feedId?: number;
  /** Inbox default: hide what has been read. */
  unreadOnly?: boolean;
  /**
   * Short video is its own screen, so the two lists that matter want opposite
   * halves of the table: 'exclude' for the inbox, 'only' for the shorts
   * queue. A feed's own page passes neither — a channel's page should show
   * everything that channel published.
   */
  shorts?: 'exclude' | 'only';
  limit?: number;
}

/** The article list, newest first, joined to its feed for display. */
export async function listArticles(
  filter: ArticleFilter = {},
): Promise<ArticleListItem[]> {
  const conditions = [eq(articles.isArchived, false)];
  if (filter.feedId !== undefined) {
    conditions.push(eq(articles.feedId, filter.feedId));
  }
  if (filter.unreadOnly) conditions.push(eq(articles.isRead, false));
  if (filter.shorts === 'exclude') conditions.push(ne(articles.kind, 'short'));
  if (filter.shorts === 'only') conditions.push(eq(articles.kind, 'short'));

  return db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      author: articles.author,
      excerpt: articles.excerpt,
      publishedAt: articles.publishedAt,
      isRead: articles.isRead,
      kind: articles.kind,
      imageUrl: articles.imageUrl,
      imageWidth: articles.imageWidth,
      imageHeight: articles.imageHeight,
      durationSeconds: articles.durationSeconds,
      feedId: articles.feedId,
      feedTitle: feeds.title,
      feedIconUrl: feeds.iconUrl,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(filter.limit ?? PAGE_SIZE);
}

/** One article, with its feed, for the reader pane. */
export async function getArticle(id: number) {
  const [row] = await db
    .select({
      article: articles,
      feedTitle: feeds.title,
      feedId: feeds.id,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, id));
  return row ?? null;
}

export async function setArticleRead(id: number, isRead: boolean) {
  await db.update(articles).set({ isRead }).where(eq(articles.id, id));
}

export async function setArticleArchived(id: number, isArchived: boolean) {
  await db.update(articles).set({ isArchived }).where(eq(articles.id, id));
}

/**
 * "Mark all as read", scoped the same way the lists are.
 *
 * The inbox's button passes `shorts: 'exclude'` so that clearing the inbox
 * does not silently empty the shorts queue too — a button marks read what the
 * screen under it is showing, and nothing else. A feed's own page passes only
 * its id, because that page shows everything the feed published.
 */
export async function markAllRead(
  options: { feedId?: number; shorts?: 'exclude' | 'only' } = {},
) {
  const conditions = [eq(articles.isRead, false)];
  if (options.feedId !== undefined) {
    conditions.push(eq(articles.feedId, options.feedId));
  }
  if (options.shorts === 'exclude') conditions.push(ne(articles.kind, 'short'));
  if (options.shorts === 'only') conditions.push(eq(articles.kind, 'short'));
  await db.update(articles).set({ isRead: true }).where(and(...conditions));
}

/**
 * Unread counts for the two sidebar badges.
 *
 * Split the same way the lists are, so each badge counts exactly what its
 * screen shows. An Inbox badge that included shorts would read "12" over a
 * list of two articles, which is the worst kind of wrong number.
 */
async function countUnreadWhere(kindFilter: SQL) {
  const [row] = await db
    .select({ value: count() })
    .from(articles)
    .where(
      and(
        eq(articles.isRead, false),
        eq(articles.isArchived, false),
        kindFilter,
      ),
    );
  return row?.value ?? 0;
}

/** Unread articles — shorts excluded, they have their own badge. */
export function countUnread(): Promise<number> {
  return countUnreadWhere(ne(articles.kind, 'short'));
}

/** Unread shorts, for the Shorts badge. */
export function countUnreadShorts(): Promise<number> {
  return countUnreadWhere(eq(articles.kind, 'short'));
}
