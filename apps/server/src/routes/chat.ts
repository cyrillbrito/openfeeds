import {
  createAnalyticsMiddleware,
  createPersistenceMiddleware,
  createTools,
  getSystemPrompt,
} from '@repo/domain/ai';
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { Hono } from 'hono';
import { env } from '~/env';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

/**
 * POST /api/chat — AI chat streaming over Server-Sent Events.
 *
 * Parses the AG-UI `RunAgentInput` wire body via the canonical
 * `chatParamsFromRequestBody` helper (validates against AG-UI's
 * `RunAgentInputSchema`, normalizes messages for `chat({ messages })`,
 * and exposes `forwardedProps` for per-session client overrides like
 * `sessionId`). The stream is returned as SSE — Hono passes the
 * `Response` through unchanged.
 */
export const chatRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .post('/', async (c) => {
    const user = c.var.user;

    if (!env.ANTHROPIC_API_KEY) {
      return c.json({ message: 'AI chat is not configured' }, 503);
    }

    let params: Awaited<ReturnType<typeof chatParamsFromRequestBody>>;
    try {
      params = await chatParamsFromRequestBody(await c.req.json());
    } catch (err) {
      return c.json(
        { message: err instanceof Error ? err.message : 'Invalid chat request body' },
        400,
      );
    }

    const sessionId = params.forwardedProps.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return c.json({ message: 'forwardedProps.sessionId is required' }, 400);
    }

    return toServerSentEventsResponse(
      chat({
        adapter: anthropicText(env.AI_MODEL),
        systemPrompts: [getSystemPrompt()],
        messages: params.messages,
        tools: createTools({ id: user.id, plan: user.plan }),
        middleware: [
          createPersistenceMiddleware(user.id, sessionId),
          createAnalyticsMiddleware(user.id),
        ],
        maxTokens: 4096,
      }),
    );
  });
