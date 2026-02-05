import { createFileRoute, redirect } from '@tanstack/solid-router';
import { $$hasAnyFeeds } from '~/entities/feeds.server';
import { authMiddleware } from '~/server/middleware/auth';

export const Route = createFileRoute('/')({
  server: {
    middleware: [authMiddleware],
  },
  loader: async () => {
    const hasFeeds = await $$hasAnyFeeds();
    throw redirect({ to: hasFeeds ? '/inbox' : '/feeds' });
  },
});
