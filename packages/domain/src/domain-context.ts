import { articles, feedTags, feeds, tags, type Db, type Transaction } from '@repo/db';
import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { captureException } from './error-tracking';
import { type Plan, parsePlan } from './limits.schema';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface DomainContext {
  userId: string;
  conn: Db | Transaction;
  plan: Plan;
}

export interface TransactionContext extends DomainContext {
  conn: Transaction;
  afterCommit: (effect: () => Promise<unknown>) => void;
}

// ---------------------------------------------------------------------------
// Scoped query helper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeScope(userIdColumn: PgColumn<any>, userId: string) {
  return {
    where: (...conditions: (SQL | undefined)[]) => and(eq(userIdColumn, userId), ...conditions),
  };
}

/**
 * Returns the db connection and per-table `where()` helpers that always include
 * the user filter. Callers get full Drizzle flexibility (columns, joins, ordering,
 * pagination) but can never forget to scope by userId.
 *
 * @example
 * ```ts
 * const q = scopedQuery(ctx);
 * const rows = await q.db
 *   .select({ id: feeds.id, title: feeds.title })
 *   .from(feeds)
 *   .where(q.feeds.where(ilike(feeds.title, pattern)))
 *   .orderBy(asc(feeds.title));
 * ```
 */
export function scopedQuery(ctx: DomainContext) {
  return {
    db: ctx.conn,
    feeds: makeScope(feeds.userId, ctx.userId),
    articles: makeScope(articles.userId, ctx.userId),
    tags: makeScope(tags.userId, ctx.userId),
    feedTags: makeScope(feedTags.userId, ctx.userId),
  };
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

export function createDomainContext(conn: Db, userId: string, plan?: string | null): DomainContext {
  return { userId, conn, plan: parsePlan(plan) };
}

export async function withTransaction<T>(
  conn: Db,
  userId: string,
  plan: string | undefined | null,
  fn: (ctx: TransactionContext) => Promise<T>,
): Promise<T> {
  const safePlan = parsePlan(plan);
  const pendingEffects: Array<() => Promise<unknown>> = [];

  const result = await conn.transaction(async (tx) => {
    const ctx: TransactionContext = {
      userId,
      plan: safePlan,
      conn: tx,
      afterCommit: (effect) => {
        pendingEffects.push(effect);
      },
    };
    return fn(ctx);
  });

  // Transaction committed — flush deferred effects (failures are reported, not thrown,
  // since the DB transaction already committed and callers shouldn't see phantom errors).
  await Promise.all(
    pendingEffects.map((effect) =>
      effect().catch((err) => {
        captureException(err instanceof Error ? err : new Error(String(err)), {
          source: 'afterCommit',
        });
      }),
    ),
  );

  return result;
}
