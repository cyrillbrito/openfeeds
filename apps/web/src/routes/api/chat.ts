import { createFileRoute } from '@tanstack/solid-router';
import type { AuthContext } from '~/server/middleware/auth';
import { authRequestMiddleware } from '~/server/middleware/auth';

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

        const body = await request.json();
        // sessionId is sent as a per-message body override, which the ChatClient
        // places under body.data — fall back to top-level for forward compat.
        const { messages, context: chatContext } = body;
        const sessionId: string | undefined = body.sessionId ?? body.data?.sessionId;

        console.log('[chat-api] Request received', {
          hasMessages: !!messages,
          messageCount: messages?.length,
          sessionId,
          bodyKeys: Object.keys(body),
          dataKeys: body.data ? Object.keys(body.data) : null,
        });

        if (!sessionId || typeof sessionId !== 'string') {
          console.warn('[chat-api] Missing sessionId', {
            body: JSON.stringify(body).slice(0, 500),
          });
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
            parts.push(`Viewing feed: "${chatContext.feedTitle}" (id: ${chatContext.feedId})`);
          if (chatContext.articleTitle)
            parts.push(
              `Viewing article: "${chatContext.articleTitle}" (id: ${chatContext.articleId})`,
            );
          if (chatContext.currentRoute) parts.push(`Current page: ${chatContext.currentRoute}`);
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
            messages,
            tools,
            maxTokens: 4096,
            middleware,
          }),
        );
      },
    },
  },
});
