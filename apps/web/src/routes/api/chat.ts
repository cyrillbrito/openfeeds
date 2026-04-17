import type { ModelMessage } from '@tanstack/ai';
import { createFileRoute } from '@tanstack/solid-router';
import { z } from 'zod';
import type { AuthContext } from '~/server/middleware/auth';
import { authRequestMiddleware } from '~/server/middleware/auth';

/** Truncate to prevent oversized values bloating the system prompt */
function sanitize(value: string, maxLength = 200): string {
  return value.slice(0, maxLength);
}

const ChatRequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())) as unknown as z.ZodType<ModelMessage[]>,
  sessionId: z.string().uuid().optional(),
  data: z.object({ sessionId: z.string().uuid() }).optional(),
  context: z
    .object({
      feedId: z.string().uuid().optional(),
      feedTitle: z.string().optional(),
      articleId: z.string().uuid().optional(),
      articleTitle: z.string().optional(),
      currentRoute: z.string().optional(),
    })
    .optional(),
});

export const Route = createFileRoute('/api/chat')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user } = context as unknown as AuthContext;

        const { chat, toServerSentEventsResponse } = await import('@tanstack/ai');
        const { anthropicText } = await import('@tanstack/ai-anthropic');
        const { createTools } = await import('~/server/ai-tools.server');
        const { getSystemPrompt } = await import('~/server/ai-system-prompt.server');
        const { env } = await import('~/env');

        if (!env.ANTHROPIC_API_KEY) {
          return new Response('AI chat is not configured', { status: 503 });
        }

        const parsed = ChatRequestSchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response(`Invalid request body: ${parsed.error.issues[0]?.message}`, {
            status: 400,
          });
        }

        const { messages, context: chatContext } = parsed.data;
        const sessionId = parsed.data.sessionId ?? parsed.data.data?.sessionId;

        if (!sessionId) {
          return new Response('Missing sessionId', { status: 400 });
        }

        const { createAnalyticsMiddleware } = await import('~/server/ai-analytics.server');
        const { createPersistenceMiddleware } = await import('~/server/ai-persistence.server');

        const tools = createTools({ id: user.id, plan: user.plan });

        // Build context-aware system prompt
        const contextLines: string[] = [getSystemPrompt()];
        if (chatContext) {
          const parts: string[] = [];
          if (chatContext.feedTitle)
            parts.push(
              `Viewing feed: "${sanitize(chatContext.feedTitle)}" (id: ${chatContext.feedId})`,
            );
          if (chatContext.articleTitle)
            parts.push(
              `Viewing article: "${sanitize(chatContext.articleTitle)}" (id: ${chatContext.articleId})`,
            );
          if (chatContext.currentRoute)
            parts.push(`Current page: ${sanitize(chatContext.currentRoute, 100)}`);
          if (parts.length > 0) {
            contextLines.push(`\nUser's current context:\n${parts.join('\n')}`);
          }
        }

        // Build middleware — persistence runs server-side so messages are saved
        // even if the client closes the tab mid-stream.
        const middleware = [
          createAnalyticsMiddleware(user.id),
          createPersistenceMiddleware(user.id, sessionId),
        ];

        return toServerSentEventsResponse(
          chat({
            adapter: anthropicText('claude-haiku-4-5'),
            systemPrompts: contextLines,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated by Zod above; Anthropic adapter wants a narrower message type
            messages: messages as any,
            tools,
            maxTokens: 4096,
            middleware,
          }),
        );
      },
    },
  },
});
