# Domain Package - Business Logic

All business logic for OpenFeeds. Shared by web (server functions) and worker (job processing).

## Commands

```bash
bun check-types
```

## Architecture

**Owns:**

- Business logic (feeds, articles, tags, settings, RSS sync, archive, import)
- Queue instances and enqueueing (BullMQ Queue, not Worker)
- Infrastructure (config, logger, errors)

**Does NOT own:**

- BullMQ Worker instances → `apps/worker`
- HTTP routes → `apps/web` (server functions)

## Structure

```
src/
├── client.ts           # Client-safe exports (schemas + types only)
├── index.ts            # Server exports (full functionality)
├── entities/           # Entity schemas, types, and CRUD functions
│   ├── article.schema.ts   # Article schemas + types (client-safe)
│   ├── article.ts          # Article CRUD functions (server)
│   ├── article-tag.schema.ts
│   ├── article-tag.ts
│   ├── common.schema.ts    # PaginatedResponse, CursorQuerySchema
│   ├── common.ts
│   ├── feed.schema.ts
│   ├── feed.ts
│   ├── filter-rule.schema.ts  # FilterRule + evaluateRule(), shouldMarkAsRead()
│   ├── filter-rule.ts
│   ├── settings.schema.ts
│   ├── settings.ts
│   ├── tag.schema.ts
│   ├── tag.ts
│   └── tts.schema.ts       # WordTiming, ArticleAudioMetadata types
├── archive.ts          # Cross-entity archive operations
├── config.ts           # Direct exports: redisConnection, posthog, shutdownDomain()
├── db-utils.ts         # Database utilities
├── email.ts            # Email sending
├── errors.ts           # Domain error classes
├── export.ts           # OPML export
├── feed-details.ts     # Feed metadata fetching
├── import.ts           # OPML import + ImportResult type
├── logger.ts           # Logging utilities
├── queues.ts           # Queue instances and enqueueing
├── rss-fetch.ts        # RSS feed fetching
├── rule-evaluation.ts  # Filter rule evaluation logic
└── tts.ts              # Text-to-speech functions
```

## Client/Server Split

Each entity is split into two files:

- **`.schema.ts`** - Zod schemas, types, pure functions (client-safe)
- **`.ts`** - CRUD functions using `@repo/db` (server-only)

**Two entry points:**

- `@repo/domain/client` - Client-safe exports (schemas, types, pure functions)
- `@repo/domain` - Full server exports (includes CRUD functions)

**Import pattern:**

```typescript
// Client code (components, routes)

// Server code (server functions, worker)
import { createFeed, type Feed } from '@repo/domain';
import { FeedSchema, FilterOperator, type Feed } from '@repo/domain/client';
```

## Entity File Pattern

**Schema file (`.schema.ts`):**

```typescript
import { z } from 'zod';

// Schema definitions
export const FeedSchema = z.object({ ... });
export const CreateFeedSchema = z.object({ ... });

// Types derived from schemas
export type Feed = z.infer<typeof FeedSchema>;
export type CreateFeed = z.infer<typeof CreateFeedSchema>;

// Pure functions (no DB access)
export function someUtility(feed: Feed): boolean { ... }
```

**Server file (`.ts`):**

```typescript
import { db } from '@repo/db';
import type { CreateFeed, Feed } from './feed.schema';

// Re-export schema for server barrel
export * from './feed.schema';

// CRUD functions (use DB)
export async function createFeed(userId: string, data: CreateFeed): Promise<Feed> { ... }
export async function getFeed(userId: string, id: string): Promise<Feed | null> { ... }
```

**Key rules:**

- Schema files have NO `@repo/db` imports
- Server files re-export from schema via `export * from './X.schema'`
- Pure utility functions go in schema files
- CRUD/DB operations go in server files

## Key Modules

**Entities:** article, article-tag, feed, filter-rule, settings, tag

**Cross-Entity Operations:** archive, import, export, feed-details, tts

**Infrastructure:** queues, config, logger, errors

## Queue Architecture

**Exports:**

- Queue instances: `feedSyncOrchestratorQueue`, `singleFeedSyncQueue`, `feedDetailQueue`, `autoArchiveQueue`
- Enqueue functions: `enqueueFeedSync()`, `enqueueFeedDetail()`, `initializeScheduledJobs()`
- Config: `QUEUE_NAMES`, `redisConnection`

**Scheduled Jobs (`initializeScheduledJobs()`):**

- Feed sync orchestrator: `* * * * *` (every minute)
- Auto archive: `0 0 * * *` (daily at midnight)

**Pattern:**

1. Server enqueues via `enqueueFeedSync()`, `enqueueFeedDetail()`
2. Worker creates Worker instances, calls domain business logic
3. Both connect to same Redis queues

## Guidelines

- Pure business logic only (no HTTP, no Workers)
- Owns Queue instances and enqueueing, NOT Worker instances
- Throw domain errors: `NotFoundError`, `ConflictError`, `UnauthorizedError`, etc.
- Import utilities from `@repo/shared/utils`
