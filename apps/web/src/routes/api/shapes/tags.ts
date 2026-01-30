import { createFileRoute } from '@tanstack/solid-router';
import { proxyElectricRequest } from '~/lib/electric-proxy';
import { authRequestMiddleware, type AuthContext } from '~/server/middleware/auth';

export const Route = createFileRoute('/api/shapes/tags')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: ({ request, context }) => {
        const { user } = context as unknown as AuthContext;
        return proxyElectricRequest({
          request,
          table: 'tags',
          where: `user_id = '${user.id}'`,
        });
      },
    },
  },
});
