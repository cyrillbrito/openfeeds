# Database Package - Drizzle ORM

Drizzle ORM with PostgreSQL. Two separate schemas: user data and auth (Better Auth).

## Commands

```bash
bun user-db-generate   # Generate user schema migrations
bun auth-db-generate   # Generate auth schema migrations
```

## Architecture

- **User Schema:** RSS feeds, articles, tags, read status — `drizzle.config.ts`
- **Auth Schema:** Better Auth tables (users, sessions) — `drizzle-auth.config.ts`
- **Direct import:** `import { db, feeds } from '@repo/db'` — no init functions, validates env on import

## Migration Workflow

**User schema changes:**

1. Modify table definitions in schema files
2. `bun user-db-generate` to create migration
3. `bun migrate` to apply
4. Commit schema + migration files

**Auth schema changes:**

1. Update Better Auth config in `apps/web/src/server/auth.ts`
2. `bun auth-db-generate`
3. `bun migrate`

Never modify migration files manually. Migrations run via `apps/migrator`.

## User ID Denormalization (Critical)

**Every table MUST have a `user_id` column with an index.** Including junction/join tables.

Electric SQL shapes cannot JOIN/subquery in where clauses. Without `user_id` directly on each table, we'd need `WHERE id IN (...)` with thousands of IDs, causing HTTP 414 errors.

**Pattern:**

```typescript
export const articleTags = pgTable(
  'article_tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('article_tags_user_id_idx').on(table.userId),
    uniqueIndex('unique_article_tag').on(table.articleId, table.tagId),
  ],
);
```

**Checklist for new tables:**

- [ ] Add `userId` column with `references(() => user.id, { onDelete: 'cascade' })`
- [ ] Add `index('table_name_user_id_idx').on(table.userId)`
- [ ] Add `user` relation in the relations definition
- [ ] Update shared Zod schemas to include `userId`
- [ ] Update domain functions to pass `userId` on insert
- [ ] Update shape handlers to filter by `user_id`

## Electric SQL

Runs in automatic mode — manages publications, replica identity, and subscriptions automatically. No manual publication setup needed.
