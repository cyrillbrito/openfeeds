import { sql } from 'drizzle-orm';
import type { Transaction } from './config';

/**
 * Get the current PostgreSQL transaction ID.
 * Must be called inside a `db.transaction()` callback.
 *
 * The `::xid` cast strips off the epoch, giving the raw 32-bit value
 * that matches what PostgreSQL sends in logical replication streams
 * (which is what Electric SQL uses to track sync progress).
 *
 * Used by server functions to return `{ txid }` to TanStack DB collection
 * handlers, keeping the optimistic overlay active until Electric confirms
 * the mutation has been synced.
 */
export async function getTxId(tx: Transaction): Promise<number> {
  const result = await tx.execute(sql`SELECT pg_current_xact_id()::xid::text as txid`);
  const txid = result[0]?.txid;
  if (txid === undefined) {
    throw new Error('Failed to get transaction ID');
  }
  return parseInt(txid as string, 10);
}
