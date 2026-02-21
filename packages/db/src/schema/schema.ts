import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

/** RSS/Atom feed subscriptions (unique per user+feedUrl) */
export const feeds = pgTable(
  'feeds',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    /** Website URL (not the feed URL) */
    url: text('url').notNull(),
    /** RSS/Atom feed URL for fetching articles */
    feedUrl: text('feed_url').notNull(),
    icon: text('icon'),
    lastSyncAt: timestamp('last_sync_at'),
    /** Sync health: 'ok' | 'failing' | 'broken' */
    syncStatus: text('sync_status').notNull().default('ok'),
    /** Last sync error message (null when healthy) */
    syncError: text('sync_error'),
    /** Consecutive sync failure count */
    /** HTTP ETag header from last successful fetch (for conditional requests) */
    etagHeader: text('etag_header'),
    /** HTTP Last-Modified header from last successful fetch (for conditional requests) */
    lastModifiedHeader: text('last_modified_header'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('feeds_user_id_idx').on(table.userId),
    uniqueIndex('feeds_user_feed_url_idx').on(table.userId, table.feedUrl),
  ],
);

/**
 * Articles from RSS feeds or user-saved URLs
 * - feedId null = saved from URL (not from feed)
 * - guid used for deduplication during RSS sync
 */
export const articles = pgTable(
  'articles',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Null for user-saved URLs */
    feedId: uuid('feed_id').references(() => feeds.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url'),
    description: text('description'),
    /** Original HTML content from RSS */
    content: text('content'),
    author: text('author'),
    /** RSS guid for deduplication */
    guid: text('guid'),
    pubDate: timestamp('pub_date'),
    isRead: boolean('is_read').default(false),
    isArchived: boolean('is_archived').default(false),
    /** Readable content (extracted on-demand) */
    cleanContent: text('clean_content'),
    contentExtractedAt: timestamp('content_extracted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('articles_user_id_idx').on(table.userId),
    index('articles_feed_id_idx').on(table.feedId),
  ],
);

/** User tags for organizing feeds/articles (feed tags auto-apply to new articles) */
export const tags = pgTable(
  'tags',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Tailwind color name - validated at API layer */
    color: text('color'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('tags_user_name_idx').on(table.userId, table.name)],
);

/** Feed-tag junction (userId denormalized for easy sync) */
export const feedTags = pgTable(
  'feed_tags',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    feedId: uuid('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('feed_tags_user_id_idx').on(table.userId),
    uniqueIndex('unique_feed_tag').on(table.feedId, table.tagId),
    index('feed_tags_tag_idx').on(table.tagId),
  ],
);

/** Article-tag junction (userId denormalized for easy sync) */
export const articleTags = pgTable(
  'article_tags',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('article_tags_user_id_idx').on(table.userId),
    uniqueIndex('unique_article_tag').on(table.articleId, table.tagId),
    index('article_tags_tag_idx').on(table.tagId),
  ],
);

/** User preferences (1:1 with user, created lazily) */
export const settings = pgTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('system'),
  /** null = use app default */
  autoArchiveDays: integer('auto_archive_days'),
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
    .notNull()
    .defaultNow(),
});

/** Per-feed rules to auto-mark articles as read based on title matching */
export const filterRules = pgTable(
  'filter_rules',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    feedId: uuid('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    /** Text to match against article title */
    pattern: text('pattern').notNull(),
    /** 'includes' or 'not_includes' */
    operator: text('operator').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('filter_rules_user_id_idx').on(table.userId),
    index('filter_rules_feed_id_idx').on(table.feedId),
    index('filter_rules_active_idx').on(table.isActive),
  ],
);

// Relations
export const feedsRelations = relations(feeds, ({ one, many }) => ({
  user: one(user, {
    fields: [feeds.userId],
    references: [user.id],
  }),
  articles: many(articles),
  feedTags: many(feedTags),
  filterRules: many(filterRules),
  syncLogs: many(feedSyncLogs),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  user: one(user, {
    fields: [articles.userId],
    references: [user.id],
  }),
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
  articleTags: many(articleTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
  feedTags: many(feedTags),
  articleTags: many(articleTags),
}));

export const feedTagsRelations = relations(feedTags, ({ one }) => ({
  user: one(user, {
    fields: [feedTags.userId],
    references: [user.id],
  }),
  feed: one(feeds, {
    fields: [feedTags.feedId],
    references: [feeds.id],
  }),
  tag: one(tags, {
    fields: [feedTags.tagId],
    references: [tags.id],
  }),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  user: one(user, {
    fields: [articleTags.userId],
    references: [user.id],
  }),
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(user, {
    fields: [settings.userId],
    references: [user.id],
  }),
}));

export const filterRulesRelations = relations(filterRules, ({ one }) => ({
  user: one(user, {
    fields: [filterRules.userId],
    references: [user.id],
  }),
  feed: one(feeds, {
    fields: [filterRules.feedId],
    references: [feeds.id],
  }),
}));

/**
 * Append-only log of every feed sync attempt.
 * Server-side only — not synced to the client via Electric SQL.
 * Used for debugging and traceability.
 */
export const feedSyncLogs = pgTable(
  'feed_sync_logs',
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    feedId: uuid('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    /** 'ok' | 'skipped' | 'failed' */
    status: text('status').notNull(),
    /** How long the sync took in milliseconds */
    durationMs: integer('duration_ms'),
    /** HTTP status code (null for network errors or timeouts) */
    httpStatus: integer('http_status'),
    /** Error message when status is 'failed' */
    error: text('error'),
    /** Number of new articles inserted */
    articlesAdded: integer('articles_added').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('feed_sync_logs_user_id_idx').on(table.userId),
    index('feed_sync_logs_feed_id_idx').on(table.feedId),
    index('feed_sync_logs_created_at_idx').on(table.createdAt),
  ],
);

export const feedSyncLogsRelations = relations(feedSyncLogs, ({ one }) => ({
  user: one(user, {
    fields: [feedSyncLogs.userId],
    references: [user.id],
  }),
  feed: one(feeds, {
    fields: [feedSyncLogs.feedId],
    references: [feeds.id],
  }),
}));

// Types derived from schema
export type DbFeed = typeof feeds.$inferSelect;
export type DbInsertFeed = typeof feeds.$inferInsert;
export type DbArticle = typeof articles.$inferSelect;
export type DbTag = typeof tags.$inferSelect;
export type DbFeedTag = typeof feedTags.$inferSelect;
export type DbArticleTag = typeof articleTags.$inferSelect;
export type DbSettings = typeof settings.$inferSelect;
export type DbInsertSettings = typeof settings.$inferInsert;
export type DbFilterRule = typeof filterRules.$inferSelect;
export type DbFeedSyncLog = typeof feedSyncLogs.$inferSelect;
export type DbInsertFeedSyncLog = typeof feedSyncLogs.$inferInsert;
