import { zValidator } from '@hono/zod-validator';
import {
  createAnalyticsMiddleware,
  createPersistenceMiddleware,
  createTools,
  getSystemPrompt,
} from '@repo/domain/ai';
import { chat, toServerSentEventsResponse, type ModelMessage } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '~/env';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/**
 * Loose body validator — `ModelMessage[]` has a wide shape; Zod just makes
 * sure it's an array of `{ role, content }` objects. Content is unknown
 * because the adapter (anthropic) accepts strings or content blocks.
 */
const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.unknown(),
      }),
    )
    .min(1),
  // sessionId is sent by the client as a per-message body override (see
  // chat-context.tsx). Used by the persistence middleware to save the run.
  sessionId: z.string().min(1),
});

/**
 * POST /api/chat — AI chat streaming over Server-Sent Events.
 *
 * Auth + body validation → builds a TanStack AI stream with the user's
 * scoped tools, the OpenFeeds system prompt, persistence (writes the full
 * conversation to chat_sessions on finish/error/abort) and PostHog LLM
 * analytics. The stream is returned as SSE — Hono passes the `Response`
 * through unchanged.
 */
export const chatRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .post('/', zValidator('json', chatBody), (c) => {
    const user = c.var.user;
    requireUser(user);

    if (!env.ANTHROPIC_API_KEY) {
      return c.json({ message: 'AI chat is not configured' }, 503);
    }

    const { messages, sessionId } = c.req.valid('json');

    return toServerSentEventsResponse(
      chat({
        adapter: anthropicText(env.AI_MODEL),
        systemPrompts: [getSystemPrompt()],
        // Zod validates the wire shape; the adapter wants a much narrower
        // type (Anthropic-specific content blocks). The cast bypasses TS;
        // the runtime payload still goes through Zod first.
        messages: messages as unknown as ModelMessage[],
        tools: createTools({ id: user.id, plan: user.plan }),
        middleware: [
          createPersistenceMiddleware(user.id, sessionId),
          createAnalyticsMiddleware(user.id),
        ],
        maxTokens: 4096,
      }),
    );
  });
