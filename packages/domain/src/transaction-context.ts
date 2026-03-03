import { AsyncLocalStorage } from 'node:async_hooks';
import type { Db, Transaction } from '@repo/db';

interface TransactionContext {
  pendingEffects: Array<() => Promise<unknown>>;
}

const txContext = new AsyncLocalStorage<TransactionContext>();

/**
 * Run `fn` inside a database transaction. Any effects deferred with `afterTransactionCommit`
 * during `fn` are flushed **after** the transaction commits successfully.
 *
 * If `fn` throws, the transaction rolls back and deferred effects are discarded.
 *
 * **Nesting:** If already inside a `withTransaction`, the inner call reuses the
 * parent transaction — `fn` runs directly and its `afterTransactionCommit` effects are pushed
 * onto the parent's queue, flushing only when the outermost transaction commits.
 *
 * Accepts `Db | Transaction` so callers that receive either type can use it
 * without narrowing. When `conn` is already a `Transaction`, the call is treated
 * as nested (no new transaction is opened).
 */
export async function withTransaction<T>(
  conn: Db | Transaction,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  // Already inside a transaction (ALS context exists, or conn is a Transaction) → join parent
  if (txContext.getStore()) {
    return fn(conn as Transaction);
  }

  const ctx: TransactionContext = { pendingEffects: [] };

  const result = await txContext.run(ctx, () => (conn as Db).transaction((tx) => fn(tx)));

  // Transaction committed — flush deferred effects
  await Promise.all(ctx.pendingEffects.map((effect) => effect()));

  return result;
}

/**
 * Schedule a side-effect to run after the current transaction commits.
 * If there's no active transaction, the effect fires immediately.
 */
export function afterTransactionCommit(effect: () => Promise<unknown>): Promise<unknown> | void {
  const ctx = txContext.getStore();
  if (ctx) {
    ctx.pendingEffects.push(effect);
  } else {
    return effect();
  }
}
