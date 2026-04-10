import { createFileRoute } from '@tanstack/solid-router';

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { chat, toServerSentEventsResponse } = await import('@tanstack/ai');
        const { anthropicText } = await import('@tanstack/ai-anthropic');
        const { auth } = await import('~/server/auth.server');
        const { createTools } = await import('~/server/ai-tools.server');
        const { getSystemPrompt } = await import('~/server/ai-system-prompt.server');
        const { env } = await import('~/env');

        if (!env.ANTHROPIC_API_KEY) {
          return new Response('AI chat is not configured', { status: 503 });
        }

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        const body = await request.json();
        const { messages, context } = body;

        const { createAnalyticsMiddleware } = await import('~/server/ai-analytics.server');

        const tools = createTools(session.user.id, session.user.plan ?? 'free');

        // Build context-aware system prompt
        const contextLines: string[] = [getSystemPrompt()];
        if (context) {
          const parts: string[] = [];
          if (context.feedTitle)
            parts.push(`Viewing feed: "${context.feedTitle}" (id: ${context.feedId})`);
          if (context.articleTitle)
            parts.push(`Viewing article: "${context.articleTitle}" (id: ${context.articleId})`);
          if (context.currentRoute) parts.push(`Current page: ${context.currentRoute}`);
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
            middleware: [createAnalyticsMiddleware(session.user.id)],
          }),
        );
      },
    },
  },
});
