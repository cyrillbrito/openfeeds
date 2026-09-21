// Reads, kept apart from sync.ts's write path.
//
// Every function takes `userId` first. `feeds` and `articles` are global, so
// scoping is a join through `subscriptions`: a user sees an article because
// they follow its feed. Read state is a LEFT JOIN — no row means unread.
import 'server-only';

import { and, desc, eq, ne, type SQL, sql } from 'drizzle-orm';

import { type ArticleKind } from '../../lib/article-kind';
import { db } from '../db';
import { articles, articleState, feeds, subscriptions } from '../db/schema';

/** How many articles a list page returns at once. */
const PAGE_SIZE = 50;

/** This user's state for this article, or nothing. */
const stateOf = (userId: string) =>
  and(eq(articleState.articleId, articles.id), eq(articleState.userId, userId));

/** No state row means unread. */
const notRead = sql`not coalesce(${articleState.isRead}, false)`;

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
 * A LEFT JOIN with a conditional count, NOT a correlated subquery — Drizzle
 * renders columns unqualified when one table is in scope, so a subquery's
 * `"id"` silently binds to the inner table. A join forces qualification.
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
      // `::int` because count() is bigint, which the driver returns as a string.
      unreadCount: sql<number>`count(case when ${articles.id} is not null and not coalesce(${articleState.isRead}, false) then 1 end)::int`,
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
  /** The preview derived at sync time — never the raw `summary`. */
  excerpt: string | null;
  publishedAt: Date | null;
  isRead: boolean;
  kind: ArticleKind;
  imageUrl: string | null;
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
   * 'exclude' for the inbox, 'only' for the shorts queue. A feed's own page
   * passes neither — it should show everything that feed published.
   */
  shorts?: 'exclude' | 'only';
  limit?: number;
}

/** The article list, newest first, joined to its feed for display. */
export async function listArticles(
  userId: string,
  filter: ArticleFilter = {},
): Promise<ArticleListItem[]> {
  const conditions = [eq(subscriptions.userId, userId)];
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

/** Set read state, creating the row if this is the first touch. */
export async function setArticleRead(
  userId: string,
  articleId: number,
  isRead: boolean,
) {
  await db
    .insert(articleState)
    .values({ userId, articleId, isRead })
    .onConflictDoUpdate({
      target: [articleState.userId, articleState.articleId],
      set: { isRead, updatedAt: new Date() },
    });
}

/**
 * "Mark all as read", scoped the same way the lists are, so a button only
 * marks what the screen under it is showing.
 *
 * INSERT ... SELECT rather than UPDATE: most of the articles being marked
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

/** Split the same way the lists are, so each badge counts what its screen shows. */
async function countUnreadWhere(userId: string, kindFilter: SQL) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(articles)
    .innerJoin(subscriptions, eq(subscriptions.feedId, articles.feedId))
    .leftJoin(articleState, stateOf(userId))
    .where(and(eq(subscriptions.userId, userId), notRead, kindFilter));
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
