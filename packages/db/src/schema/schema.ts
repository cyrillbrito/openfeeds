import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const feeds = pgTable(
  'feeds',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    /** Webpage url */
    url: text('url').notNull(),
    /** RSS Feed url */
    feedUrl: text('feed_url').notNull(),
    /** Site favicon/icon url */
    icon: text('icon'),
    /** last time articles where fetched */
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('feeds_user_id_idx').on(table.userId),
    uniqueIndex('feeds_user_feed_url_idx').on(table.userId, table.feedUrl),
  ],
);

export const articles = pgTable(
  'articles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Null for articles saved from URL (not tied to a feed) */
    feedId: text('feed_id').references(() => feeds.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url'),
    description: text('description'),
    content: text('content'), // full article content if available
    author: text('author'),
    guid: text('guid'),
    pubDate: timestamp('pub_date'),
    isRead: boolean('is_read').default(false),
    isArchived: boolean('is_archived').default(false),
    cleanContent: text('clean_content'), // processed readable content
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('articles_user_id_idx').on(table.userId),
    index('articles_feed_id_idx').on(table.feedId),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // TODO Enum the color
    // FIXME: Should we validate color values at the database level?
    /** Can be one of the chromatic tailwind colors or null */
    color: text('color'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('tags_user_name_idx').on(table.userId, table.name)],
);

// Many-to-many relationship between feeds and tags
export const feedTags = pgTable(
  'feed_tags',
  {
    id: text('id').primaryKey(),
    feedId: text('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('unique_feed_tag').on(table.feedId, table.tagId),
    index('feed_tags_tag_idx').on(table.tagId),
  ],
);

// Many-to-many relationship between articles and tags
export const articleTags = pgTable(
  'article_tags',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('unique_article_tag').on(table.articleId, table.tagId),
    index('article_tags_tag_idx').on(table.tagId),
  ],
);

/**
 * Not really sure why doing settings as key-value.
 * Since they can be kind of dynamic, to see if this works well.
 */
export const settings = pgTable(
  'settings',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('settings_user_key_idx').on(table.userId, table.key)],
);

export const filterRules = pgTable(
  'filter_rules',
  {
    id: text('id').primaryKey(),
    feedId: text('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    pattern: text('pattern').notNull(),
    operator: text('operator').notNull(), // 'includes' or 'not_includes'
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
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

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(user, {
    fields: [settings.userId],
    references: [user.id],
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
