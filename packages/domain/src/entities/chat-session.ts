import { chatSessions } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import type { TransactionContext } from '../domain-context';
import type { SaveChatSessionInput } from './chat-session.schema';

// Re-export schemas and types from schema file
export * from './chat-session.schema';

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
