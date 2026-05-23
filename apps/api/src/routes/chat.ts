import { chat, toServerSentEventsResponse, type ModelMessage } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { Elysia, t } from 'elysia';
import { env } from '~/env';
import { authPlugin, requireUser } from '~/middleware/auth';

/**
 * POST /api/chat — AI chat streaming over Server-Sent Events.
 *
 * Stripped-down prototype: no tools, no persistence, no analytics.
 * Just proves `@tanstack/ai`'s SSE Response works untouched when returned
 * from an Elysia handler, and that auth + body validation flow end-to-end.
 *
 * The real chat route (apps/web/src/routes/api/chat.ts) has tools, system
 * prompts, persistence middleware — porting those means moving more files
 * out of apps/web/ which is out of scope for the prototype.
 */
export const chatRoutes = new Elysia({ prefix: '/api2/chat' }).use(authPlugin).post(
  '/',
  ({ body, user, status }) => {
    requireUser(user);

    if (!env.ANTHROPIC_API_KEY) {
      return status(503, { message: 'AI chat is not configured' });
    }

    return toServerSentEventsResponse(
      chat({
        adapter: anthropicText(env.AI_MODEL),
        systemPrompts: ['You are a helpful assistant for an RSS reader app.'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elysia validates shape; ai-anthropic wants a narrower message type.
        messages: body.messages as any,
        maxTokens: 1024,
      }),
    );
  },
  {
    body: t.Object({
      // Loose validation — `ModelMessage[]` has a wide shape; Elysia ensures
      // it's an array of objects with role + content fields.
      messages: t.Array(
        t.Object({
          role: t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]),
          content: t.Unknown(),
        }),
        { minItems: 1 },
      ),
    }),
  },
);

// Re-export to silence unused import if ModelMessage isn't referenced directly
export type _ModelMessage = ModelMessage;
