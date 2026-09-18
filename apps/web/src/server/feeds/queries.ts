// Reads. Kept apart from sync.ts so the write path (fetching, parsing,
// scheduling) and the read path (what the UI renders) stay separable.
//
// Every function here takes `userId` first. `feeds` and `articles` are
// global, so the scoping is a join through `subscriptions`: a user sees an
// article because they follow its feed. Read and archived state comes from
// `article_state` by LEFT JOIN, because no row means unread.
import 'server-only';

import { and, desc, eq, isNull, ne, or, type SQL, sql } from 'drizzle-orm';

import { type ArticleKind } from '../../lib/article-kind';
import { db } from '../db';
import { articles, articleState, feeds, subscriptions } from '../db/schema';

/** How many articles a list page returns at once. */
const PAGE_SIZE = 50;

/** This user's state for this article, or nothing. */
const stateOf = (userId: string) =>
  and(eq(articleState.articleId, articles.id), eq(articleState.userId, userId));

/** No state row means unread and unarchived. */
const notRead = or(isNull(articleState.isRead), eq(articleState.isRead, false));
const notArchived = or(
  isNull(articleState.isArchived),
  eq(articleState.isArchived, false),
);

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
 * The sidebar: every feed this user follows, with their unread count.
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
 * and the correlation is then the join condition itself. LEFT so a feed with
 * no articles still appears.
 */
export async function listFeeds(userId: string): Promise<FeedSummary[]> {
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
      // `::int` because count() is bigint, which the driver hands back as a
      // string — a badge reading "12" that is secretly text sorts and adds
      // wrong everywhere downstream.
      unreadCount: sql<number>`count(case when ${articles.id} is not null and not coalesce(${articleState.isRead}, false) and not coalesce(${articleState.isArchived}, false) then 1 end)::int`,
    })
    .from(subscriptions)
    .innerJoin(feeds, eq(subscriptions.feedId, feeds.id))
    .leftJoin(articles, eq(articles.feedId, feeds.id))
    .leftJoin(articleState, stateOf(userId))
    .where(eq(subscriptions.userId, userId))
    .groupBy(feeds.id)
    .orderBy(feeds.title);
}

/** A feed, only if this user follows it. */
export async function getFeed(userId: string, id: number) {
  const [feed] = await db
    .select()
    .from(feeds)
    .innerJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
    .where(and(eq(feeds.id, id), eq(subscriptions.userId, userId)));
  return feed?.feeds ?? null;
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
  userId: string,
  filter: ArticleFilter = {},
): Promise<ArticleListItem[]> {
  const conditions = [eq(subscriptions.userId, userId), notArchived];
  if (filter.feedId !== undefined) {
    conditions.push(eq(articles.feedId, filter.feedId));
  }
  if (filter.unreadOnly) conditions.push(notRead);
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
      isRead: sql<boolean>`coalesce(${articleState.isRead}, false)`,
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
    .innerJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
    .leftJoin(articleState, stateOf(userId))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(filter.limit ?? PAGE_SIZE);
}

/** Write one flag, creating the state row if this is the first touch. */
async function setState(
  userId: string,
  articleId: number,
  values: { isRead?: boolean; isArchived?: boolean },
) {
  await db
    .insert(articleState)
    .values({ userId, articleId, ...values })
    .onConflictDoUpdate({
      target: [articleState.userId, articleState.articleId],
      set: { ...values, updatedAt: new Date() },
    });
}

export function setArticleRead(
  userId: string,
  articleId: number,
  isRead: boolean,
) {
  return setState(userId, articleId, { isRead });
}

export function setArticleArchived(
  userId: string,
  articleId: number,
  isArchived: boolean,
) {
  return setState(userId, articleId, { isArchived });
}

/**
 * "Mark all as read", scoped the same way the lists are.
 *
 * The inbox's button passes `shorts: 'exclude'` so that clearing the inbox
 * does not silently empty the shorts queue too — a button marks read what the
 * screen under it is showing, and nothing else. A feed's own page passes only
 * its id, because that page shows everything the feed published.
 *
 * INSERT ... SELECT rather than an UPDATE: most of the articles being marked
 * have no state row yet, so there is nothing to update.
 */
export async function markAllRead(
  userId: string,
  options: { feedId?: number; shorts?: 'exclude' | 'only' } = {},
) {
  const conditions = [eq(subscriptions.userId, userId)];
  if (options.feedId !== undefined) {
    conditions.push(eq(articles.feedId, options.feedId));
  }
  if (options.shorts === 'exclude') conditions.push(ne(articles.kind, 'short'));
  if (options.shorts === 'only') conditions.push(eq(articles.kind, 'short'));

  // Every column of article_state, in declaration order: Drizzle's
  // INSERT ... SELECT rejects a partial or reordered projection.
  const target = db
    .select({
      userId: sql<string>`${userId}`.as('user_id'),
      articleId: articles.id,
      isRead: sql<boolean>`true`.as('is_read'),
      isArchived: sql<boolean>`false`.as('is_archived'),
      updatedAt: sql`now()`.as('updated_at'),
    })
    .from(articles)
    .innerJoin(subscriptions, eq(subscriptions.feedId, articles.feedId))
    .where(and(...conditions));

  await db
    .insert(articleState)
    .select(target)
    .onConflictDoUpdate({
      target: [articleState.userId, articleState.articleId],
      set: { isRead: true, updatedAt: new Date() },
    });
}

/**
 * Unread counts for the two sidebar badges.
 *
 * Split the same way the lists are, so each badge counts exactly what its
 * screen shows. An Inbox badge that included shorts would read "12" over a
 * list of two articles, which is the worst kind of wrong number.
 */
async function countUnreadWhere(userId: string, kindFilter: SQL) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(articles)
    .innerJoin(subscriptions, eq(subscriptions.feedId, articles.feedId))
    .leftJoin(articleState, stateOf(userId))
    .where(
      and(
        eq(subscriptions.userId, userId),
        notRead,
        notArchived,
        kindFilter,
      ),
    );
  return row?.value ?? 0;
}

/** Unread articles — shorts excluded, they have their own badge. */
export function countUnread(userId: string): Promise<number> {
  return countUnreadWhere(userId, ne(articles.kind, 'short'));
}

/** Unread shorts, for the Shorts badge. */
export function countUnreadShorts(userId: string): Promise<number> {
  return countUnreadWhere(userId, eq(articles.kind, 'short'));
}
