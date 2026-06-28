import {
  createAnalyticsMiddleware,
  createPersistenceMiddleware,
  createTools,
  getSystemPrompt,
} from '@repo/domain/ai';
import {
  chat,
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
  type StreamChunk,
} from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { Hono } from 'hono';
import { env } from '~/env';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

/**
 * If no stream chunk arrives from the upstream provider within this window,
 * we abort the request and surface an error. Without this, an Anthropic-side
 * stall (which has been observed with large tool_use JSON inputs) leaves the
 * browser spinner running forever with no feedback.
 */
const STREAM_INACTIVITY_TIMEOUT_MS = 30_000;

/**
 * Wrap a chunk async-iterable with an inactivity watchdog. If no chunk arrives
 * within `timeoutMs`, calls `controller.abort()` and throws — the thrown error
 * propagates through `toServerSentEventsResponse` to the client.
 */
async function* withInactivityTimeout(
  stream: AsyncIterable<StreamChunk>,
  controller: AbortController,
  timeoutMs: number,
  ctx: { userId: string; sessionId: string },
): AsyncIterable<StreamChunk> {
  const iter = stream[Symbol.asyncIterator]();
  while (true) {
    let timer!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `AI provider stopped responding (no data for ${Math.round(timeoutMs / 1000)}s). Please try again.`,
          ),
        );
      }, timeoutMs);
    });

    let result: IteratorResult<StreamChunk>;
    try {
      result = await Promise.race([iter.next(), timeoutPromise]);
      // Stop the watchdog as soon as a chunk arrives — we don't want the timer
      // to keep ticking while the consumer drains the yielded value downstream
      // (backpressure on the SSE sink could otherwise trip the timeout on a
      // healthy stream).
      clearTimeout(timer);
    } catch (err) {
      clearTimeout(timer);
      // eslint-disable-next-line no-console
      console.error('[chat] stream aborted', {
        ...ctx,
        reason: err instanceof Error ? err.message : String(err),
      });
      // Best-effort: tell the underlying iterator to clean up
      await iter.return?.().catch(() => undefined);
      throw err;
    }
    if (result.done) return;
    yield result.value;
  }
}

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

    console.info('[chat] start stream', {
      userId: user.id,
      sessionId,
      messageCount: params.messages.length,
      at: new Date().toISOString(),
    });

    const abortController = new AbortController();

    const stream = chat({
      adapter: anthropicText(env.AI_MODEL),
      systemPrompts: [getSystemPrompt()],
      messages: params.messages,
      tools: createTools({ id: user.id, plan: user.plan }),
      middleware: [
        createPersistenceMiddleware(user.id, sessionId),
        createAnalyticsMiddleware(user.id),
      ],
      modelOptions: {
        max_tokens: 4096,
      },
      abortController,
    });

    return toServerSentEventsResponse(
      withInactivityTimeout(stream, abortController, STREAM_INACTIVITY_TIMEOUT_MS, {
        userId: user.id,
        sessionId,
      }),
      { abortController },
    );
  });
