// The database. Multi-user, shared and fully normalised (docs/v2-plan.md):
// `feeds` and `articles` are global — one row per canonical feed URL, one
// row per entry, fetched once no matter how many people subscribe. Who
// follows what is `subscriptions`; who has read what is `article_state`.
//
// Nothing global carries a `userId`, so the two per-user tables are the
// only place a missing filter can leak another user's data.
//
// Two conventions are global here, both cheap now and expensive to change
// later:
//
//  1. TIMESTAMPS ARE `timestamptz`. Postgres has a real date type, so the
//     old integer-milliseconds convention is gone — the column is an
//     absolute instant, comparisons happen in SQL, and Drizzle hands JS a
//     Date. Always `withTimezone`: a bare `timestamp` silently drops the
//     offset and reintroduces exactly the ambiguity the type exists to fix.
//  2. FEED IDENTITY IS THE CANONICAL URL. `feedUrl` is unique across the
//     whole table, which is what lets one fetch serve every subscriber once
//     `subscriptions` exists.
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** `timestamptz`, nullable — the one timestamp spelling used in this file. */
const ts = (name: string) => timestamp(name, { withTimezone: true });

/**
 * A feed. GLOBAL — one row per canonical feed URL, for the whole system.
 *
 * This table doubles as the fetch queue. There is no job queue and no job
 * state: `nextFetchAt` says when a feed is next due, and the cron sweep asks
 * for rows where it has passed. Job state could only ever duplicate this and
 * then drift from it, so the feeds row is the single source of truth — which
 * is what makes the scheduler self-healing across restarts and crashes.
 *
 * Because the row is global rather than per-subscriber, the sweep fetches a
 * popular feed once no matter how many people follow it. That is the whole
 * point of the shared-database decision: 50 subscribers to one YouTube
 * channel is 1 request/hour to that host, not 50.
 */
export const feeds = pgTable(
  'feeds',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

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
    lastFetchedAt: ts('last_fetched_at'),
    /** When the sweep should next consider this feed. Past due = fetch it. */
    nextFetchAt: ts('next_fetch_at')
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

    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('feeds_feed_url_idx').on(table.feedUrl),
    // The sweep's only query: "what is due?" — ordered by due time.
    index('feeds_next_fetch_at_idx').on(table.nextFetchAt),
  ],
);

/**
 * One entry from a feed. GLOBAL, like `feeds` — the content is stored once
 * and every subscriber reads the same row.
 *
 * Dedup is `unique(feedId, guid)`: re-fetching a feed re-sees every entry it
 * still lists, so inserts are `on conflict do nothing`. Scoping the
 * constraint to the feed matters — v1 deduped on the GUID alone and dropped
 * the owner from the check, so once any user had a GUID, nobody else could
 * ever receive that article again. With global articles that class of bug is
 * structurally impossible: there is no owner in the key to forget.
 */
export const articles = pgTable(
  'articles',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    feedId: integer('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),

    /** The feed's own identifier for this entry — <guid>, <id>, or the link. */
    guid: text('guid').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    author: text('author'),
    /**
     * The feed's own body text: <description> / <summary>, or
     * `content:encoded` when that is all the feed ships.
     *
     * Kept only as the source the excerpt and the fallback thumbnail are
     * derived from. Nothing renders it — rows link out to the site.
     */
    summary: text('summary'),
    /** Feed-supplied publication date; falls back to fetch time when absent. */
    publishedAt: ts('published_at'),

    /**
     * What this entry IS, not where it came from — see src/lib/shorts.ts.
     *
     * Stored rather than derived from `url` at read time because it is a
     * classification, so it belongs beside the other things that decide which
     * screen a row shows up on. It also has to be re-derivable in bulk: the
     * rules are per-platform and will grow, and a stored column makes that an
     * UPDATE instead of a re-fetch of every feed.
     *
     * Deliberately `text` and not `pgEnum`: the enum is types-only, so the
     * column has no CHECK constraint and widening the list stays a code
     * change with no migration. A real Postgres enum would cost an
     * `ALTER TYPE` every time a new platform shows up.
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

    // Read and archived state is per-user and lives in `article_state`.

    createdAt: ts('created_at').notNull().defaultNow(),
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

// --- Per-user ---------------------------------------------------------

/**
 * Who follows which feed. The sidebar is this table, and it is also what
 * scopes every article read: an article is visible to a user because they
 * subscribe to its feed, never because of a column on the article.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    feedId: integer('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.feedId] }),
    // The primary key serves user-first lookups; this one serves
    // "does anyone still follow this feed" on unsubscribe.
    index('subscriptions_feed_id_idx').on(table.feedId),
  ],
);

/**
 * One user's read/archived state for one article.
 *
 * Rows are written on first interaction, so absence is the default state:
 * unread and not archived. Reads must therefore LEFT JOIN and coalesce — an
 * inner join here would show a user only the articles they had already
 * touched.
 */
export const articleState = pgTable(
  'article_state',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    updatedAt: ts('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.articleId] })],
);

// --- Better Auth ------------------------------------------------------
//
// Generated by `bunx auth@latest generate` (provider 'pg'), then edited to
// use `ts()` and to add `defaultNow()` on every `updated_at`. Regenerate
// when a Better Auth plugin is added: plugins add columns, and the adapter
// validates the schema and names anything missing.
//
// The singular table names and the property names are Better Auth's
// lookup keys. `id` is text because Better Auth generates its own ids.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

/** One row per sign-in method: the password hash lives here, not on `user`. */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

/** Short-lived tokens: email verification, password reset, OAuth state. */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type User = typeof user.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
