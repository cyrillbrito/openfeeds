import { createFileRoute } from '@tanstack/solid-router';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { auth } = await import('~/server/auth.server');
        return auth.handler(request);
      },
      POST: async ({ request }) => {
        const { auth } = await import('~/server/auth.server');
        return auth.handler(request);
      },
    },
  },
});
