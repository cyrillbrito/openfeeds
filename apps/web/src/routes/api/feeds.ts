import { createFileRoute } from '@tanstack/solid-router';
import { z } from 'zod/v4';
import { feedUrlSchema } from '@repo/domain/client';

const CreateFeedBody = z.object({
  url: feedUrlSchema,
});

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '';
  const isAllowed =
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    origin.includes('localhost');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const Route = createFileRoute('/api/feeds')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request),
        });
      },

      POST: async ({ request }) => {
        // Dynamic imports to keep server-only modules out of the client bundle.
        // See: https://github.com/TanStack/router/issues/2783
        const { db } = await import('@repo/db');
        const feedsDomain = await import('@repo/domain');
        const { withTransaction } = feedsDomain;
        const { auth } = await import('~/server/auth.server');

        const headers = corsHeaders(request);

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return Response.json({ message: 'Unauthorized' }, { status: 401, headers });
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ message: 'Invalid JSON' }, { status: 400, headers });
        }

        const parsed = CreateFeedBody.safeParse(json);
        if (!parsed.success) {
          return Response.json({ message: 'A valid URL is required' }, { status: 400, headers });
        }

        try {
          const [feed] = await withTransaction(
            db,
            session.user.id,
            session.user.plan,
            async (ctx) => {
              return feedsDomain.createFeeds(ctx, [{ feedUrl: parsed.data.url }]);
            },
          );
          return Response.json(feed, { status: 201, headers });
        } catch (error) {
          if (error instanceof feedsDomain.LimitExceededError) {
            return Response.json({ message: error.message }, { status: 429, headers });
          }
          if (error instanceof feedsDomain.ConflictError) {
            return Response.json({ message: error.message }, { status: 409, headers });
          }
          if (error instanceof feedsDomain.BadRequestError) {
            return Response.json({ message: error.message }, { status: 400, headers });
          }
          console.error('Failed to create feed:', error);
          return Response.json({ message: 'Internal server error' }, { status: 500, headers });
        }
      },
    },
  },
});
