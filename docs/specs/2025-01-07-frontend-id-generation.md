# Frontend ID Generation (Local-First Architecture)

**Date:** 2025-01-07
**Status:** Draft

## Why

To enable true local-first architecture, IDs need to be generated on the frontend. This enables:

- **Offline support** - Create entities without server connectivity
- **Instant optimistic UI** - No waiting for server to assign IDs
- **Conflict-free replication** - UUIDs are globally unique across devices
- **Simplified sync logic** - No need to remap temp IDs to server IDs
- **Future multi-device support** - Same user can create entities on multiple devices

## Current State

### Database Schema (`packages/db/src/schema/schema.ts`)

All main entities use SQLite auto-increment integer IDs:

```typescript
export const feeds = sqliteTable('feeds', {
  id: integer().primaryKey({ autoIncrement: true }),
  // ...
});

export const articles = sqliteTable('articles', {
  id: integer().primaryKey({ autoIncrement: true }),
  feedId: integer().references(() => feeds.id, { onDelete: 'cascade' }),
  // ...
});

export const tags = sqliteTable('tags', {
  id: integer().primaryKey({ autoIncrement: true }),
  // ...
});
```

### Shared Schemas (`packages/shared/src/schemas/*.ts`)

All ID fields are `z.number()`:

```typescript
export const FeedSchema = z.object({
  id: z.number(),
  tags: z.array(z.number()),
  // ...
});
```

### Frontend Entities (`apps/web/src/entities/*.ts`)

Uses temporary negative IDs for optimistic inserts:

```typescript
// utils.ts
export function generateTempId(): number {
  return -(Math.floor(Math.random() * 1000000) + 1);
}

// feeds.ts - bypasses temp ID by waiting for server response
export async function createFeed(data: { url: string }): Promise<Feed> {
  const { data: feed, error } = await api.feeds.post({ url: data.url });
  // ... waits for server ID
}
```

### API Routes (`apps/server/src/apps/*.ts`)

Route params expect integer IDs:

```typescript
.get('/:id', async ({ params, ... }) => {
  const feedId = Number(params.id);
  // ...
})
```

## Target State

### ID Generation Strategy

**IDs are optional on insert** - flexible hybrid approach:
- Frontend CAN generate UUID v7 and provide it (for offline/local-first)
- Backend generates UUID v7 if not provided (for server-side operations like RSS sync)

```typescript
// Schema - id is optional on create
export const CreateFeedSchema = z.object({
  id: z.string().uuid().optional(), // Frontend CAN provide
  url: z.string().url(),
});

// Backend - use provided ID or generate
export async function createFeed(db, data: CreateFeed) {
  const id = data.id ?? generateUuidV7();
  await db.insert(feeds).values({ id, ...data });
}
```

### UUID Standard: v7

Using **UUID v7** (RFC 9562, 2024) instead of v4 or ULID:

| Feature | UUID v7 |
|---------|---------|
| Time-ordered | Yes (first 48 bits = Unix timestamp in ms) |
| Sortable | Lexicographically sortable by creation time |
| Format | Standard 36-char UUID format |
| PostgreSQL | Native support in v17+ (future-proof) |
| B-tree indexing | Sequential inserts, no fragmentation |

Format: `018d4f5c-7b3e-7xxx-yxxx-xxxxxxxxxxxx` (7 = version nibble)

**Zod validation**: `z.string().uuid()` validates format only (not version nibble), so UUID v7 passes validation without changes.

### Database Schema

Change all IDs from `integer` to `text` (UUID strings):

```typescript
export const feeds = sqliteTable('feeds', {
  id: text().primaryKey(), // UUID string, no autoIncrement
  // ...
});

export const articles = sqliteTable('articles', {
  id: text().primaryKey(),
  feedId: text()
    .notNull()
    .references(() => feeds.id, { onDelete: 'cascade' }),
  // ...
});

export const tags = sqliteTable('tags', {
  id: text().primaryKey(),
  // ...
});

// Junction tables: composite primary key or UUID
export const feedTags = sqliteTable('feed_tags', {
  id: text().primaryKey(), // or remove id entirely, use composite key
  feedId: text().notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  tagId: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
});
```

### Shared Schemas

Change ID types to UUID strings:

```typescript
export const FeedSchema = z.object({
  id: z.string().uuid(),
  tags: z.array(z.string().uuid()),
  // ...
});
```

### Frontend Entities

Generate UUID v7 on insert (optional - can also let backend generate):

```typescript
// utils.ts
import { uuidv7 } from 'uuidv7'; // or similar library

export function generateId(): string {
  return uuidv7();
}

// feeds.ts - can insert immediately with frontend-generated ID
export function createFeed(data: { url: string }): void {
  feedsCollection.insert({
    id: generateId(), // Frontend generates UUID v7
    url: data.url,
    // ... default values
  });
  // Server sync happens in background via onInsert
}

// Alternative: let backend generate (for online-only operations)
export async function createFeedOnline(data: { url: string }): Promise<Feed> {
  const { data: feed } = await api.feeds.post({ url: data.url }); // No id sent
  feedsCollection.utils.writeInsert(feed); // Backend-generated ID
  return feed;
}
```

### API Routes

Accept string IDs:

```typescript
.get('/:id', async ({ params, ... }) => {
  const feedId = params.id; // Already a string UUID
  // ...
})
```

## Work Breakdown

### Phase 1: Shared Types & Schemas

1. Update `packages/shared/src/schemas/*.ts`:
   - `FeedSchema.id`: `z.number()` → `z.string().uuid()`
   - `ArticleSchema.id`: `z.number()` → `z.string().uuid()`
   - `ArticleSchema.feedId`: `z.number()` → `z.string().uuid()`
   - `TagSchema.id`: `z.number()` → `z.string().uuid()`
   - `FilterRuleSchema.id`: `z.number()` → `z.string().uuid()`
   - All `tags: z.array(z.number())` → `tags: z.array(z.string().uuid())`

### Phase 2: Database Schema

1. Update `packages/db/src/schema/schema.ts`:
   - Change all `id: integer().primaryKey({ autoIncrement: true })` to `id: text().primaryKey()`
   - Change all foreign key columns from `integer()` to `text()`
   - Update type exports: `DbFeed`, `DbArticle`, etc. will automatically infer new types

2. Create migration:
   - This is a breaking change requiring data migration
   - **Option A**: Fresh migration for new users, manual migration script for existing
   - **Option B**: SQLite migration to convert integer IDs to UUIDs (complex)

### Phase 3: Domain Layer

1. Update `packages/domain/src/*.ts`:
   - Accept `id` as optional parameter in create functions
   - Generate UUID v7 if not provided
   - Update all ID parameters from `number` to `string`

2. Add UUID v7 generation utility:
   - Add `uuidv7` package to `@repo/shared` or `@repo/domain`
   - Create shared `generateId()` function

Example change:
```typescript
// Before
export async function createFeed(db, feed: Omit<DbInsertFeed, 'id'>) {
  const [newFeed] = await db.insert(feeds).values(feed).returning();
  return newFeed; // id was auto-generated by SQLite
}

// After
import { uuidv7 } from 'uuidv7';

export async function createFeed(db, feed: DbInsertFeed & { id?: string }) {
  const id = feed.id ?? uuidv7(); // Use provided or generate
  const newFeed = { ...feed, id };
  await db.insert(feeds).values(newFeed);
  return newFeed;
}
```

### Phase 4: API Routes

1. Update `apps/server/src/apps/*.ts`:
   - Remove `Number(params.id)` conversions
   - Update route param validation to expect UUID strings
   - Update request body schemas for ID fields

### Phase 5: Frontend Entities

1. Update `apps/web/src/entities/utils.ts`:
   - Replace `generateTempId()` with `generateId()` using `crypto.randomUUID()`

2. Update all entity files:
   - Change `getKey: (item) => item.id` (already works with strings)
   - Update `createX()` functions to generate UUID and insert immediately
   - Remove any temp ID handling logic
   - Update all ID type annotations from `number` to `string`

3. Update `apps/web/src/entities/*.ts`:
   - `feeds.ts`: `createFeed()` generates UUID, inserts immediately
   - `tags.ts`: `createTag()` generates UUID, inserts immediately
   - `filter-rules.ts`: `createFilterRule()` generates UUID, inserts immediately
   - All update/delete functions: change `id: number` to `id: string`

### Phase 6: Frontend Components

1. Update route params:
   - `$feedId`, `$tagId`, `$articleId` remain strings (already are in URL)
   - Remove `Number()` conversions where used

2. Update component props and state:
   - Any `feedId: number` → `feedId: string`
   - Any `tagId: number` → `tagId: string`

## Migration Strategy

### For Development/New Databases

1. Update schema
2. Run `bun db:generate` to create new migration
3. New databases will have text IDs

### For Existing Production Data

Two options:

**Option A: Clean Break (Recommended for Beta)**
- Users start fresh with new database
- Provide OPML export before migration
- Simple, no data corruption risk

**Option B: Data Migration Script**
```sql
-- Create new tables with text IDs
-- Copy data, converting integer IDs to UUIDs
-- Drop old tables, rename new tables
-- Complex, needs thorough testing
```

## Considerations

### UUID v7 Generation

**Backend (Bun/Node):**
```typescript
// Option 1: Use 'uuidv7' package
import { uuidv7 } from 'uuidv7';
const id = uuidv7();

// Option 2: Use 'uuid' package (v9+)
import { v7 as uuidv7 } from 'uuid';
const id = uuidv7();
```

**Frontend (Browser):**
```typescript
// Same packages work, or polyfill with:
import { uuidv7 } from 'uuidv7'; // ~1KB gzipped
```

Note: `crypto.randomUUID()` only generates v4. For v7, need a library.

### SQLite Performance

Text primary keys vs integer:
- Slightly larger storage (36 bytes vs 8 bytes)
- Index lookups marginally slower
- For this app's scale (per-user DBs, thousands of rows max), negligible impact

### Type Safety

Drizzle will automatically infer new types:
```typescript
type DbFeed = typeof feeds.$inferSelect;
// Before: { id: number, ... }
// After: { id: string, ... }
```

Zod schemas provide runtime validation:
```typescript
FeedSchema.parse({ id: "not-a-uuid" }); // Throws error
FeedSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" }); // OK
```

## Testing

- [ ] New entities can be created offline (simulated)
- [ ] UUIDs are correctly generated on frontend
- [ ] Server accepts and stores frontend-generated UUIDs
- [ ] Foreign key relationships work with text IDs
- [ ] All E2E tests pass with new ID format
- [ ] URL routes work with UUID params

## Open Questions

1. **Articles ID generation**: Articles are created server-side during RSS sync. Should they also use frontend-generated UUIDs, or remain server-generated? (Likely server-generated since user doesn't create articles)

2. **Junction table IDs**: Should `feedTags` and `articleTags` use composite primary keys `(feedId, tagId)` instead of separate UUID? (Probably yes, cleaner)

3. **Migration timing**: When to cut over? Before or after implementing offline support?
