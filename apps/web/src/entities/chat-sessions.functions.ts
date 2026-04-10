import { db } from '@repo/db';
import * as domain from '@repo/domain';
import { SaveChatSessionSchema, withTransaction } from '@repo/domain';
import type { StoredMessage } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

async function _loadSession(
  userId: string,
  plan: string | null | undefined,
  id: string,
): Promise<{ id: string; title: string; messages: StoredMessage[] }> {
  const ctx = domain.createDomainContext(db, userId, plan);
  const session = await domain.loadChatSession(ctx, id);
  if (session) {
    return { id: session.id, title: session.title, messages: session.messages };
  }
  const empty: StoredMessage[] = [];
  return { id, title: '', messages: empty };
}

/** List recent sessions (summaries only — no messages) */
export const $$listChatSessions = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = domain.createDomainContext(db, context.user.id, context.user.plan);
    return domain.listChatSessions(ctx);
  });

/** Load a single session with full messages. Returns empty messages array if not found. */
export const $$loadChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.string())
  // @ts-expect-error -- oxlint false positive: infers StoredMessage[] | never[] through helper despite explicit return type
  .handler(async ({ context, data: id }) => {
    return _loadSession(context.user.id, context.user.plan, id);
  });

/** Create or update a session (upsert) */
export const $$saveChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(SaveChatSessionSchema)
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domain.saveChatSession(ctx, data);
    });
  });

/** Delete a session */
export const $$deleteChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }): Promise<void> => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domain.deleteChatSession(ctx, data.id);
    });
  });
