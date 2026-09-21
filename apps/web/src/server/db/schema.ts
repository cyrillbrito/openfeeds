// `feeds` and `articles` are global — one row per canonical feed URL, one
// row per entry, fetched once no matter how many people subscribe. Who
// follows what is `subscriptions`; who has read what is `article_state`.
// Nothing global carries a `userId`, so those two tables are the only place
// a missing filter can leak another user's data.
//
// Timestamps are always `timestamptz` — a bare `timestamp` drops the offset.
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
 * A feed, and the fetch queue: `nextFetchAt` is when it is next due and the
 * cron sweep selects rows where it has passed. No separate job state, so a
 * crash or restart resumes from the row itself.
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

    // Conditional GET: stored verbatim from the last successful response and
    // echoed back as If-None-Match / If-Modified-Since.
    etag: text('etag'),
    lastModified: text('last_modified'),

    // --- Fetch scheduling & health --------------------------------------
    lastFetchedAt: ts('last_fetched_at'),
    /** When the sweep should next consider this feed. Past due = fetch it. */
    nextFetchAt: ts('next_fetch_at')
      .notNull()
      .$defaultFn(() => new Date()),
    /** Consecutive failures and the latest reason; both shown in the UI. */
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
 * One entry from a feed, stored once for every subscriber.
 *
 * Dedup is `unique(feedId, guid)`: re-fetching re-sees every entry a feed
 * still lists, so inserts are `on conflict do nothing`.
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
     * The feed's own body text. Kept only as the source `excerpt` and the
     * fallback thumbnail are derived from; nothing renders it.
     */
    summary: text('summary'),
    /** Feed-supplied publication date; falls back to fetch time when absent. */
    publishedAt: ts('published_at'),

    /**
     * What the entry IS — see src/lib/article-kind.ts. Decides which screen
     * it appears on and how its row is laid out.
     *
     * `text` rather than `pgEnum`: the enum is types-only, so widening the
     * list is a code change with no `ALTER TYPE`.
     */
    kind: text('kind', {
      enum: ['article', 'short', 'video', 'podcast', 'note'],
    })
      .notNull()
      .default('article'),

    /**
     * The list's preview line, derived at sync time so `summary` never has
     * to be selected into an SSR payload. Empty string means the kind shows
     * no preview.
     */
    excerpt: text('excerpt'),

    /** The row's thumbnail — see server/feeds/media.ts for the sources. */
    imageUrl: text('image_url'),

    /** Seconds. The duration badge on video and podcast rows. */
    durationSeconds: integer('duration_seconds'),

    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('articles_feed_guid_idx').on(table.feedId, table.guid),
    // The inbox: unread, newest first. The feed page adds feedId on top.
    index('articles_published_at_idx').on(table.publishedAt),
    index('articles_feed_id_idx').on(table.feedId),
    // Both list queries filter on kind first: the inbox excludes shorts, the
    // shorts queue takes only them.
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
 * Who follows which feed. Also what scopes every article read: an article is
 * visible because the user follows its feed, never via a column on the row.
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
 * One user's read state for one article. Rows are written on first
 * interaction, so absence means unread — reads LEFT JOIN and coalesce.
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
// use `ts()` and `defaultNow()`. The singular table names and the property
// names are Better Auth's lookup keys; regenerate when adding a plugin.

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
