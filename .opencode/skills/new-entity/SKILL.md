---
name: new-entity
description: "Add a new entity or feature end-to-end across the full stack: domain, database, collections, server functions, and error handling. Use when creating a new data type or feature that needs client-server sync. Do not use for database-only changes (use database skill) or UI-only changes (use solidjs skill)."
---

# New Entity Skill

Create a new entity spanning domain, database, web collections, and server functions. Follow these steps in order.

## Step 1: Domain Schema

Create `packages/domain/src/entities/<entity>.schema.ts`. This file is client-safe — NO `@repo/db` imports. Define Zod schemas, TypeScript types, and pure functions only.

```typescript
import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Entity = z.infer<typeof EntitySchema>;
```

Export from `@repo/domain/client` entry point.

Read `references/domain-split.md` for the full client/server export pattern.

## Step 2: Domain CRUD

Create `packages/domain/src/entities/<entity>.ts`. This file is server-only — imports `@repo/db`. Re-export schema via `export * from './<entity>.schema'`.

```typescript
export * from './<entity>.schema';

import type { TransactionContext } from '../domain-context';
import { entities } from '@repo/db';

export async function createEntity(ctx: TransactionContext, data: CreateEntityInput) {
  const [result] = await ctx.conn
    .insert(entities)
    .values({ ...data, userId: ctx.userId })
    .returning();
  assert(result, 'Created entity must exist');

  ctx.afterCommit(() => trackEvent(ctx.userId, 'entities:entity_create', { entity_id: result.id }));
  return result;
}
```

Rules for domain CRUD functions:
1. Throw domain errors directly — never catch/wrap at domain level.
2. Write error messages that are user-safe (they reach the client as-is).
3. Defer side effects (analytics, queue jobs) via `ctx.afterCommit()`.
4. Export from `@repo/domain` entry point.

## Step 3: Database Table

Load the `database` skill. Follow its new table procedure for UUIDv7 PKs, user_id denormalization, and migration generation.

## Step 4: Web Collection

Create `apps/web/src/entities/<entity>.ts` with Electric SQL sync.

```typescript
import { createCollection } from '@tanstack/solid-db';
import { electricCollectionOptions } from '@tanstack/solid-db-electric';
import { EntitySchema } from '@repo/domain/client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';

export const entitiesCollection = createCollection(
  electricCollectionOptions({
    id: 'entities',
    schema: EntitySchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: getShapeUrl('entities'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('entities.shape'),
    },
    onInsert: collectionErrorHandler('entities.onInsert', async ({ transaction }) => {
      const items = transaction.mutations.map((m) => ({
        id: m.key as string,
        name: m.modified.name,
      }));
      return await $$createEntities({ data: items });
    }),
    onUpdate: collectionErrorHandler('entities.onUpdate', async ({ transaction }) => {
      return await $$updateEntities({ data: /* batch updates */ });
    }),
    onDelete: collectionErrorHandler('entities.onDelete', async ({ transaction }) => {
      return await $$deleteEntities({ data: /* batch deletes */ });
    }),
  }),
);
```

Read `references/collection-pattern.md` for error handler details, fire-and-forget mutation patterns, and toast service wiring.

## Step 5: Server Functions

Create `apps/web/src/entities/<entity>.functions.ts`.

```typescript
import { createServerFn } from '@tanstack/solid-start';
import { authMiddleware } from '~/server/middleware';
import * as domain from '@repo/domain';
import { db, getTxId } from '@repo/db';
import { withTransaction } from '@repo/domain';

export const $$createEntities = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await domain.createEntities(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });
```

Rules for server functions:
1. Always use `authMiddleware`.
2. Wrap mutation domain calls in `withTransaction` and return `{ txid }`.
3. Use `inputValidator` for Zod validation on complex inputs.
4. Import from `@repo/domain` (full server exports), not `@repo/domain/client`.

Read `references/server-functions.md` for import protection rules and API routes vs server functions.

## Step 6: Error Handling

Read `references/error-handling.md` when adding new domain error types.

Quick procedure for a new domain error:
1. Define error class in `packages/domain/src/errors.ts` with user-safe default message.
2. Add to `DOMAIN_ERRORS` array in `packages/domain/src/error-boundary.ts`.
3. Export from `packages/domain/src/index.ts`.

Client code only sees `err.message` — no `instanceof`, no `code` property.

## Step 7: Shape Handler

Add Electric SQL shape proxy for the new table in the web app's shape configuration. Filter by `user_id`.
