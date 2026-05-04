# Domain Client/Server Split

Each entity in `packages/domain/src/entities/` is split into two files:

## `.schema.ts` — Client-safe

- Zod schemas and TypeScript types
- Pure functions (validation, transformation)
- NO `@repo/db` imports
- Exported via `@repo/domain/client` entry point

```typescript
// entities/feed.schema.ts
import { z } from 'zod';

export const FeedSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string().url(),
  title: z.string().nullable(),
  // ...
});

export type Feed = z.infer<typeof FeedSchema>;

// Pure functions
export function formatFeedTitle(feed: Feed): string {
  return feed.title ?? new URL(feed.url).hostname;
}
```

## `.ts` — Server-only CRUD

- Imports `@repo/db`
- Re-exports everything from `.schema.ts` via `export * from './feed.schema'`
- Contains CRUD functions that take domain context
- Exported via `@repo/domain` entry point

```typescript
// entities/feed.ts
export * from './feed.schema';

import type { TransactionContext, DomainContext } from '../domain-context';
import { feeds } from '@repo/db';

export async function createFeeds(ctx: TransactionContext, data: CreateFeedInput[]) {
  // ... insert, return results
}

export async function getActiveFeedsForUser(ctx: DomainContext) {
  // ... query
}
```

## Two Entry Points

| Entry point            | Contains                         | Used by                        |
| ---------------------- | -------------------------------- | ------------------------------ |
| `@repo/domain/client`  | Schemas, types, pure functions   | Client code (collections, UI)  |
| `@repo/domain`         | Full server exports including CRUD | Server code (server fns, workers) |

**Import rule:** Client code must NEVER import from `@repo/domain` (would pull in `@repo/db` and server deps). Always use `@repo/domain/client`.
