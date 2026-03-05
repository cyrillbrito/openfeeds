import type { Db, Transaction } from '@repo/db';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface DomainContext {
  userId: string;
  conn: Db | Transaction;
}

export interface TransactionContext extends DomainContext {
  conn: Transaction;
  afterCommit: (effect: () => Promise<unknown>) => void;
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

export function createDomainContext(conn: Db, userId: string): DomainContext {
  return { userId, conn };
}

export async function withTransaction<T>(
  conn: Db,
  userId: string,
  fn: (ctx: TransactionContext) => Promise<T>,
): Promise<T> {
  const pendingEffects: Array<() => Promise<unknown>> = [];

  const result = await conn.transaction(async (tx) => {
    const ctx: TransactionContext = {
      userId,
      conn: tx,
      afterCommit: (effect) => {
        pendingEffects.push(effect);
      },
    };
    return fn(ctx);
  });

  // Transaction committed — flush deferred effects
  await Promise.all(pendingEffects.map((effect) => effect()));

  return result;
}
