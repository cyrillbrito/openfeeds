import { createFileRoute, redirect } from '@tanstack/solid-router';
import { isServer } from 'solid-js/web';
import { $$hasAnyFeeds } from '~/entities/feeds.server';
import { authClient } from '~/lib/auth-client';
import { authMiddleware } from '~/server/middleware/auth';

export const Route = createFileRoute('/')({
  server: {
    middleware: [authMiddleware],
  },
  beforeLoad: async () => {
    if (isServer) return;
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const hasFeeds = await $$hasAnyFeeds();
    throw redirect({ to: hasFeeds ? '/inbox' : '/feeds' });
  },
});
