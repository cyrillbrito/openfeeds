# User ID Denormalization Pattern

## Table Definition

```typescript
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
  ],
);
```

## Checklist for New Tables

- [ ] Add `userId` column with `references(() => user.id, { onDelete: 'cascade' })`
- [ ] Add `index('table_name_user_id_idx').on(table.userId)`
- [ ] Add `user` relation in the relations definition
- [ ] Update shared Zod schemas to include `userId`
- [ ] Update domain functions to pass `userId` on insert
- [ ] Update shape handlers to filter by `user_id`
