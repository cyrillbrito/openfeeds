---
name: new-entity
description: "Add a new entity or feature end-to-end across the full stack: domain, database, collections, server routes, and error handling. Use when creating a new data type or feature that needs client-server sync. Do not use for database-only changes (use database skill) or UI-only changes (use solidjs skill)."
---

# New Entity Skill

Create a new entity spanning domain, database, web collections, and Hono routes. Follow these steps in order.

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

export const CreateEntitySchema = EntitySchema.pick({ id: true, name: true });
export type CreateEntityInput = z.infer<typeof CreateEntitySchema>;
```

Export from `@repo/domain/client` entry point.

Read `references/domain-split.md` for the full client/server export pattern.

## Step 2: Domain CRUD

Create `packages/domain/src/entities/<entity>.ts`. This file is server-only — imports `@repo/db`. Re-export schema via `export * from './<entity>.schema'`.

```typescript
export * from './<entity>.schema';

import type { TransactionContext } from '../domain-context';
import { entities } from '@repo/db';

export async function createEntities(ctx: TransactionContext, data: CreateEntityInput[]) {
  const rows = await ctx.conn
    .insert(entities)
    .values(data.map((d) => ({ ...d, userId: ctx.userId })))
    .returning();

  ctx.afterCommit(() =>
    rows.forEach((r) => trackEvent(ctx.userId, 'entities:entity_create', { entity_id: r.id })),
  );
  return rows;
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

Create `apps/web/src/entities/<entity>.ts` with Electric SQL sync. Mutations call typed Hono RPC routes via `api` from `~/lib/api-client`.

```typescript
import { snakeCamelMapper } from '@electric-sql/client';
import { EntitySchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection, useLiveQuery } from '@tanstack/solid-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

export const entitiesCollection = createCollection(
  electricCollectionOptions({
    id: 'entities',
    schema: EntitySchema,
    getKey: (item) => item.id,

    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,

    shapeOptions: {
      url: getShapeUrl('entities'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('entities.shape'),
    },

    onInsert: collectionErrorHandler('entities.onInsert', async ({ transaction }) => {
      const items = transaction.mutations.map((m) => ({
        id: String(m.key),
        name: m.modified.name,
      }));
      return await unwrap(api.api.entities.create.$post({ json: items }));
    }),
    onUpdate: collectionErrorHandler('entities.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((m) => ({
        id: String(m.key),
        ...m.changes,
      }));
      return await unwrap(api.api.entities.update.$patch({ json: updates }));
    }),
    onDelete: collectionErrorHandler('entities.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((m) => String(m.key));
      return await unwrap(api.api.entities.delete.$post({ json: ids }));
    }),
  }),
);

export function useEntities() {
  return useLiveQuery((q) => q.from({ entity: entitiesCollection }));
}
```

Read `references/collection-pattern.md` for error handler details, fire-and-forget mutation patterns, and toast service wiring.

## Step 5: Hono Route

Create `apps/server/src/routes/<entity>.ts`. Routes are thin — validate, wrap in `withTransaction`, return `{ txid }` for the optimistic handshake.

```typescript
import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createEntities,
  CreateEntitySchema,
  deleteEntities,
  updateEntities,
  UpdateEntitySchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

export const entitiesRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .post('/create', zValidator('json', z.array(CreateEntitySchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createEntities(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .patch('/update', zValidator('json', z.array(UpdateEntitySchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateEntities(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteEntities(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
```

Mount in `apps/server/src/index.ts` by chaining `.route('/api/entities', entitiesRoutes)` onto the existing `app` builder. Don't reassign — Hono's RPC type inference depends on a single chained reference.

Rules for routes:
1. Always use `requireAuthMiddleware` on protected entity routes — handlers get `c.var.user` typed non-null.
2. Wrap mutation domain calls in `withTransaction` and return `{ txid }`.
3. Validate every body with `zValidator('json', schema)` — schemas come from `@repo/domain`.
4. Keep handlers thin: validate → call domain → return. No business logic.

Read `references/server-functions.md` for the full Hono pattern, public-API routes (cross-origin), and RPC type-inference gotchas.

## Step 6: Error Handling

Read `references/error-handling.md` when adding new domain error types.

Quick procedure for a new domain error:
1. Define error class in `packages/domain/src/errors.ts` with user-safe default message.
2. Add to `DOMAIN_ERRORS` array in `packages/domain/src/error-boundary.ts`.
3. Export from `packages/domain/src/index.ts`.
4. If the new error needs a specific HTTP status, update `app.onError()` in `apps/server/src/index.ts`.

Client code only sees `err.message` from the JSON `{ message }` body — no `instanceof`, no `code` property.

## Step 7: Shape Handler

Add the Electric SQL shape proxy for the new table in `apps/server/src/routes/shapes.ts`. Filter by `user_id` so each shape stream is scoped to the requesting user.
