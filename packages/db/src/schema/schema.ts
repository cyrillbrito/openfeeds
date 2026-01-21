import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const feeds = sqliteTable('feeds', {
  id: text().primaryKey(),
  title: text().notNull(),
  description: text(),
  /** Webpage url */
  url: text().notNull(),
  /** RSS Feed url */
  feedUrl: text().notNull().unique(),
  /** Site favicon/icon url */
  icon: text(),
  /** last time articles where fetched */
  lastSyncAt: integer({ mode: 'timestamp' }),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const articles = sqliteTable('articles', {
  id: text().primaryKey(),
  /** Null for articles saved from URL (not tied to a feed) */
  feedId: text().references(() => feeds.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  url: text(),
  description: text(),
  content: text(), // full article content if available
  author: text(),
  guid: text(),
  pubDate: integer({ mode: 'timestamp' }),
  isRead: integer({ mode: 'boolean' }).default(false),
  isArchived: integer({ mode: 'boolean' }).default(false),
  cleanContent: text(), // processed readable content
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const tags = sqliteTable('tags', {
  id: text().primaryKey(),
  name: text().notNull().unique(),
  // TODO Enum the color
  // FIXME: Should we validate color values at the database level?
  /** Can be one of the chromatic tailwind colors or null */
  color: text(),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Many-to-many relationship between feeds and tags
export const feedTags = sqliteTable(
  'feed_tags',
  {
    id: text().primaryKey(),
    feedId: text()
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    tagId: text()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('unique_feed_tag').on(table.feedId, table.tagId)],
);

// Many-to-many relationship between articles and tags
export const articleTags = sqliteTable(
  'article_tags',
  {
    id: text().primaryKey(),
    articleId: text()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('unique_article_tag').on(table.articleId, table.tagId),
    index('article_tags_article_idx').on(table.articleId),
    index('article_tags_tag_idx').on(table.tagId),
  ],
);

/**
 * Not really sure why doing settings as key-value.
 * Since they can be kind of dynamic, to see if this works well.
 */
export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).notNull(),
  updatedAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const filterRules = sqliteTable(
  'filter_rules',
  {
    id: text().primaryKey(),
    feedId: text()
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    pattern: text().notNull(),
    operator: text().notNull(), // 'includes' or 'not_includes'
    isActive: integer({ mode: 'boolean' }).notNull().default(true),
    createdAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' }),
  },
  (table) => [
    index('filter_rules_feed_id_idx').on(table.feedId),
    index('filter_rules_active_idx').on(table.isActive),
  ],
);

// Relations
export const feedsRelations = relations(feeds, ({ many }) => ({
  articles: many(articles),
  feedTags: many(feedTags),
  filterRules: many(filterRules),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
  articleTags: many(articleTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  feedTags: many(feedTags),
  articleTags: many(articleTags),
}));

export const feedTagsRelations = relations(feedTags, ({ one }) => ({
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
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

export const filterRulesRelations = relations(filterRules, ({ one }) => ({
  feed: one(feeds, {
    fields: [filterRules.feedId],
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
export type DbSetting = typeof settings.$inferSelect;
export type DbFilterRule = typeof filterRules.$inferSelect;
