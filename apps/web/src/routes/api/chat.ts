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
        const { messages, context: chatContext } = body;

        const { createAnalyticsMiddleware } = await import('~/server/ai-analytics.server');

        const tools = createTools(user.id, user.plan ?? 'free');

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

        return toServerSentEventsResponse(
          chat({
            adapter: anthropicText('claude-sonnet-4-5'),
            systemPrompts: contextLines,
            messages,
            tools,
            maxTokens: 4096,
            middleware: [createAnalyticsMiddleware(user.id)],
          }),
        );
      },
    },
  },
});
