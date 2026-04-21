import { createFileRoute } from '@tanstack/solid-router';
import { proxyElectricRequest } from '~/lib/electric-proxy.server';
import { authRequestMiddleware, type AuthContext } from '~/server/middleware/auth';

export const Route = createFileRoute('/api/shapes/feeds')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: ({ request, context }) => {
        const { user } = context as unknown as AuthContext;
        return proxyElectricRequest({
          request,
          table: 'feeds',
          userId: user.id,
        });
      },
    },
  },
});
