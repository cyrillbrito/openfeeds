import { chatSessions } from '@repo/db';
import { and, desc, eq } from 'drizzle-orm';
import type { DomainContext, TransactionContext } from '../domain-context';
import type {
  ChatSessionSummary,
  SaveChatSessionInput,
  StoredMessage,
} from './chat-session.schema';

// Re-export schemas and types from schema file
export * from './chat-session.schema';

/** List recent sessions for a user (no message payloads — summaries only) */
export async function listChatSessions(
  ctx: DomainContext,
  limit = 50,
): Promise<ChatSessionSummary[]> {
  const rows = await ctx.conn
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, ctx.userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/** Load a single session with full messages */
export async function loadChatSession(
  ctx: DomainContext,
  sessionId: string,
): Promise<{ id: string; title: string; messages: StoredMessage[] } | null> {
  const row = await ctx.conn.query.chatSessions.findFirst({
    where: and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, ctx.userId)),
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    messages: row.messages as StoredMessage[],
  };
}

/** Create or update a session (upsert) */
export async function saveChatSession(
  ctx: TransactionContext,
  data: SaveChatSessionInput,
): Promise<void> {
  await ctx.conn
    .insert(chatSessions)
    .values({
      id: data.id,
      userId: ctx.userId,
      title: data.title,
      messages: data.messages,
    })
    .onConflictDoUpdate({
      target: chatSessions.id,
      set: {
        title: data.title,
        messages: data.messages,
        updatedAt: new Date(),
      },
    });
}

/** Delete a session */
export async function deleteChatSession(ctx: TransactionContext, id: string): Promise<void> {
  await ctx.conn
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, ctx.userId)));
}
