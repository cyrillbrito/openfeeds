import { createFileRoute } from '@tanstack/solid-router';
import { proxyElectricRequest } from '~/lib/electric-proxy';
import { authRequestMiddleware, type AuthContext } from '~/server/middleware/auth';

export const Route = createFileRoute('/api/shapes/articles')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: ({ request, context }) => {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
        const { user } = context as unknown as AuthContext;
        return proxyElectricRequest({
          request,
          table: 'articles',
          userId: user.id,
        });
      },
    },
  },
});
