import { feeds, getDb } from '@repo/db';
import { createFileRoute } from '@tanstack/solid-router';
import { eq } from 'drizzle-orm';
import { auth } from '~/server/auth';

export const Route = createFileRoute('/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          const url = new URL('/signin', request.url);
          url.searchParams.set('redirect', '/');
          return Response.redirect(url);
        }

        const db = getDb();
        const feed = await db.query.feeds.findFirst({
          columns: { id: true },
          where: eq(feeds.userId, session.user.id),
        });

        const redirectTo = feed ? '/inbox' : '/feeds';
        return Response.redirect(new URL(redirectTo, request.url));
      },
    },
  },
});
