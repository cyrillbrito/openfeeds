import type { ChatMiddleware, ChatMiddlewareContext, UIMessage } from '@tanstack/ai';
import { modelMessagesToUIMessages } from '@tanstack/ai';

/**
 * Server-side persistence middleware for TanStack AI.
 *
 * Saves the full conversation to the DB on finish, error, or abort so that
 * messages are never lost — even if the client closes the tab mid-stream.
 * Uses `ctx.defer()` so persistence never blocks streaming.
 *
 * Stores `ctx.messages` (ModelMessage[]) directly as JSON — no field mapping,
 * nothing is ever dropped. The title is derived from the UIMessage view of the
 * same messages (using modelMessagesToUIMessages).
 *
 * The server is the single source of truth — the client only displays what
 * Electric syncs back.
 */
export function createPersistenceMiddleware(userId: string, sessionId: string): ChatMiddleware {
  function save(ctx: ChatMiddlewareContext) {
    const messages = ctx.messages;

    if (messages.length === 0) return;

    ctx.defer(
      (async () => {
        try {
          const { db } = await import('@repo/db');
          const { withTransaction, saveChatSession } = await import('@repo/domain');

          const uiMessages = modelMessagesToUIMessages(
            messages as Parameters<typeof modelMessagesToUIMessages>[0],
          );
          const title = deriveTitle(uiMessages);

          await withTransaction(db, userId, undefined, async (txCtx) => {
            await saveChatSession(txCtx, {
              id: sessionId,
              title,
              messages: messages as unknown as Record<string, unknown>[],
            });
          });
        } catch (err) {
          console.error('[ai-persistence] Failed to save session', { sessionId, error: err });
          throw err;
        }
      })(),
    );
  }

  return {
    name: 'chat-persistence',

    onFinish(ctx, _info) {
      save(ctx);
    },

    onError(ctx, _info) {
      // Save whatever was accumulated before the error — partial history is
      // better than losing the whole conversation.
      save(ctx);
    },

    onAbort(ctx, _info) {
      // Save on user-initiated stop too.
      save(ctx);
    },
  };
}

// ---------------------------------------------------------------------------
// Pure helper (duplicated from chat-utils.ts to avoid importing from components/)
// ---------------------------------------------------------------------------

function deriveTitle(msgs: UIMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const textPart = firstUser.parts.find((p) => p.type === 'text' && 'content' in p);
  if (!textPart || !('content' in textPart)) return 'New chat';
  const text = (textPart as { content: string }).content.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
