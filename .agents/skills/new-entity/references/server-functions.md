# Server Functions Pattern

Server functions use `createServerFn` from TanStack Start with auth middleware. They're the bridge between client collections and domain logic.

## Standard Mutation Pattern

```typescript
import { createServerFn } from '@tanstack/solid-start';
import { authMiddleware } from '~/server/middleware';
import * as domain from '@repo/domain';
import { db, getTxId } from '@repo/db';
import { withTransaction } from '@repo/domain';
import { z } from 'zod';

export const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await domain.createFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });
```

## Key Rules

1. **Always use `authMiddleware`** — provides `context.user` with `id`, `email`, etc.
2. **Mutations return `{ txid }`** — the transaction ID is used by TanStack DB for optimistic sync confirmation.
3. **`withTransaction` owns the boundary** — domain functions never create their own top-level transactions.
4. **Use `inputValidator` for Zod validation** when the server function accepts complex input.
5. **`*.functions.ts` files are safe to import from client** — TanStack Start's compiler rewrites them to RPC stubs.

## Import Protection

- `*.server.*` files and `src/server/` directory are **blocked from client imports** (TanStack Start plugin in `vite.config.ts`).
- `*.functions.ts` files export `createServerFn` wrappers — safe for client import.
- `*.client.*` files are blocked from server imports.

## API Routes vs Server Functions

- **Server functions** → internal app use (collections call these).
- **API routes** (`src/routes/api/`) → external consumers (extension, webhooks).
