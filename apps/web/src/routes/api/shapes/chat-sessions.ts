import { createFileRoute } from '@tanstack/solid-router';
import { proxyElectricRequest } from '~/lib/electric-proxy';
import { authRequestMiddleware, type AuthContext } from '~/server/middleware/auth';

export const Route = createFileRoute('/api/shapes/chat-sessions')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: ({ request, context }) => {
        const { user } = context as unknown as AuthContext;
        return proxyElectricRequest({
          request,
          table: 'chat_sessions',
          userId: user.id,
        });
      },
    },
  },
});
