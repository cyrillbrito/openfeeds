// The database, as two tables. Single-user for now: no `userId` column
// anywhere, and no auth. That is a deliberate prototype scope — Better Auth
// and multi-user come later, and adding a `userId` is a mechanical change
// against this shape.
//
// Two conventions are global here, both cheap now and expensive to change
// later (see docs/v2-plan.md "Rabbit holes"):
//
//  1. TIMESTAMPS ARE INTEGER MILLISECONDS. SQLite has no date type, so the
//     choice has to be made once, globally. `mode: 'timestamp_ms'` stores an
//     integer and hands JS a Date — no parsing at the call site, no ISO
//     strings that sort correctly only by luck.
//  2. FEED IDENTITY IS THE CANONICAL URL. `feedUrl` is unique across the
//     whole table. Fetching is per-subscription today, but a canonical,
//     unique feed identity is the hard half of ever deduplicating fetches
//     across users — and it costs nothing to establish up front.
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * A subscription to an RSS/Atom/RDF/JSON feed.
 *
 * This table doubles as the fetch queue. There is no job queue and no job
 * state: `nextFetchAt` says when a feed is next due, and the cron sweep asks
 * for rows where it has passed. Job state could only ever duplicate this and
 * then drift from it, so the feeds row is the single source of truth — which
 * is what makes the scheduler self-healing across restarts and crashes.
 */
export const feeds = sqliteTable(
  'feeds',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Canonical feed URL — the system-wide identity of this feed. */
    feedUrl: text('feed_url').notNull(),
    /** The human site the feed belongs to, not the feed document itself. */
    siteUrl: text('site_url'),
    title: text('title').notNull(),
    description: text('description'),
    iconUrl: text('icon_url'),

    // --- Conditional GET -----------------------------------------------
    // Stored verbatim from the last successful response and echoed back as
    // If-None-Match / If-Modified-Since. A 304 costs a few hundred bytes and
    // no parse, versus re-downloading the entire feed body every sweep —
    // which is exactly what v1 did.
    etag: text('etag'),
    lastModified: text('last_modified'),

    // --- Fetch scheduling & health --------------------------------------
    lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp_ms' }),
    /** When the sweep should next consider this feed. Past due = fetch it. */
    nextFetchAt: integer('next_fetch_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    /**
     * Consecutive failures, and the reason for the latest one. RSS failures
     * are persistent (dead domain, moved feed, a new Cloudflare rule), so
     * backoff is measured in HOURS and the error is kept to be shown in the
     * UI. v1 retried in seconds and swallowed the reason, so a feed could be
     * dead for months while the UI looked healthy.
     */
    failureCount: integer('failure_count').notNull().default(0),
    lastError: text('last_error'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('feeds_feed_url_idx').on(table.feedUrl),
    // The sweep's only query: "what is due?" — ordered by due time.
    index('feeds_next_fetch_at_idx').on(table.nextFetchAt),
  ],
);

/**
 * One entry from a feed.
 *
 * Dedup is `unique(feedId, guid)`: re-fetching a feed re-sees every entry it
 * still lists, so inserts are `on conflict do nothing`. Scoping the
 * constraint to the feed matters — v1 deduped on the GUID alone and dropped
 * the owner from the check, so once any user had a GUID, nobody else could
 * ever receive that article again.
 */
export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    feedId: integer('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),

    /** The feed's own identifier for this entry — <guid>, <id>, or the link. */
    guid: text('guid').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    author: text('author'),
    /** Short form: <description> / <summary>. */
    summary: text('summary'),
    /** Long form when the feed ships it: content:encoded / <content>. */
    content: text('content'),
    /** Feed-supplied publication date; falls back to fetch time when absent. */
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),

    /**
     * What this entry IS, not where it came from — see src/lib/shorts.ts.
     *
     * Stored rather than derived from `url` at read time because it is a
     * classification, so it belongs beside the other things that decide which
     * screen a row shows up on. It also has to be re-derivable in bulk: the
     * rules are per-platform and will grow, and a stored column makes that an
     * UPDATE instead of a re-fetch of every feed.
     *
     * A Drizzle text enum is types-only — SQLite stores plain text with no
     * CHECK constraint — so widening this later needs no migration.
     */
    kind: text('kind', {
      enum: ['article', 'short', 'video', 'podcast', 'note'],
    })
      .notNull()
      .default('article'),

    /**
     * The list's two-line preview, derived once at sync time.
     *
     * Stored rather than computed per render for two reasons. The cheap one
     * is that stripping HTML with a regex on every row of every render is
     * waste. The real one is payload: deriving it here is what lets
     * listArticles stop selecting `summary`, so fifty full article bodies
     * stop being serialised into the SSR response of every inbox load.
     *
     * NULL means "not derived yet", which is distinct from a genuinely
     * empty excerpt — see server/feeds/backfill.ts.
     */
    excerpt: text('excerpt'),

    /**
     * The row's thumbnail, from whichever of the six sources had one — see
     * server/feeds/media.ts. Dimensions are kept when the feed declares them
     * (Media RSS does, most other sources do not); the layout uses fixed
     * aspect boxes and does not depend on them.
     */
    imageUrl: text('image_url'),
    imageWidth: integer('image_width'),
    imageHeight: integer('image_height'),

    /** Seconds. The duration badge on video and podcast rows. */
    durationSeconds: integer('duration_seconds'),

    /** The audio file, when the item is a podcast episode. */
    enclosureUrl: text('enclosure_url'),

    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    isArchived: integer('is_archived', { mode: 'boolean' })
      .notNull()
      .default(false),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('articles_feed_guid_idx').on(table.feedId, table.guid),
    // The inbox: unread, newest first. The feed page adds feedId on top.
    index('articles_published_at_idx').on(table.publishedAt),
    index('articles_feed_id_idx').on(table.feedId),
    // The inbox excludes shorts and the shorts queue is only shorts, so both
    // of the two busiest list queries now lead with `kind`.
    index('articles_kind_published_at_idx').on(table.kind, table.publishedAt),
  ],
);

export const feedsRelations = relations(feeds, ({ many }) => ({
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  feed: one(feeds, { fields: [articles.feedId], references: [feeds.id] }),
}));

export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
