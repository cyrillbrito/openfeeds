# Database Package - Drizzle ORM

Drizzle ORM with PostgreSQL. Two separate schemas: user data and auth (Better Auth).

## Commands

All commands run from the **repo root**:

```bash
bun --cwd packages/db drizzle-kit generate --name <migration-name>   # Generate user schema migration
bun generate:auth-schema                                              # Regenerate auth schema from Better Auth config
bun migrate                                                           # Apply all pending migrations
```

When DB schema changes are made, suggest the migration generation command to the user with a descriptive `--name` (e.g. `--name add-bookmarks-table`, `--name uuid-v7-migration`). Do not run it yourself. After generation, suggest `bun migrate` to apply.

## Architecture

- **User Schema:** RSS feeds, articles, tags, read status — `drizzle.config.ts`
- **Auth Schema:** Better Auth tables (users, sessions) — `drizzle-auth.config.ts`
- **Direct import:** `import { db, feeds } from '@repo/db'` — no init functions, validates env on import

## Migration Workflow

**User schema changes:**

1. Modify table definitions in schema files
2. Suggest `bun --cwd packages/db drizzle-kit generate --name <descriptive-name>` to the user
3. Suggest `bun migrate` to apply
4. Commit schema + migration files

**Auth schema changes:**

1. Update Better Auth config in `apps/web/src/server/auth.ts`
2. Suggest `bun generate:auth-schema` then `bun migrate` to the user

Never modify migration files manually. Migrations run via `apps/migrator`.

## ID Strategy

**All user-data table PKs use `uuid` columns with `uuidv7()` as the database default.** Auth tables (managed by Better Auth) use `text` IDs and should not be changed.

- **PKs:** `uuid().default(sql`uuidv7()`).primaryKey()`
- **FKs to user-data tables:** `uuid('column_name').references(() => table.id, ...)`
- **FKs to auth tables (`user_id`):** `text('user_id').references(() => user.id, ...)` — stays `text`
- **Client-side ID generation:** `createId()` from `@repo/shared/utils` (returns UUID v7 via `uuidv7` package)
- **Server-side fallback:** If no ID is passed, Postgres generates one via `uuidv7()`

## User ID Denormalization (Critical)

**Every table MUST have a `user_id` column with an index.** Including junction/join tables.

Electric SQL shapes cannot JOIN/subquery in where clauses. Without `user_id` directly on each table, we'd need `WHERE id IN (...)` with thousands of IDs, causing HTTP 414 errors.

**Pattern:**

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

**Checklist for new tables:**

- [ ] Add `userId` column with `references(() => user.id, { onDelete: 'cascade' })`
- [ ] Add `index('table_name_user_id_idx').on(table.userId)`
- [ ] Add `user` relation in the relations definition
- [ ] Update shared Zod schemas to include `userId`
- [ ] Update domain functions to pass `userId` on insert
- [ ] Update shape handlers to filter by `user_id`

## Electric SQL

Runs in automatic mode — manages publications, replica identity, and subscriptions automatically. No manual publication setup needed.
