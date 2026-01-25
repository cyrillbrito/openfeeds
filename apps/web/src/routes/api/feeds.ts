import { getUserDb } from '@repo/db';
import * as feedsDomain from '@repo/domain';
import { createFileRoute } from '@tanstack/solid-router';
import { getAuth } from '~/server/auth';

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
        const headers = corsHeaders(request);

        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) {
          return Response.json({ message: 'Unauthorized' }, { status: 401, headers });
        }

        let body: { url?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ message: 'Invalid JSON' }, { status: 400, headers });
        }

        if (!body.url || typeof body.url !== 'string') {
          return Response.json({ message: 'URL is required' }, { status: 400, headers });
        }

        try {
          const db = getUserDb(session.user.id);
          const feed = await feedsDomain.createFeed({ url: body.url }, session.user.id, db);
          return Response.json(feed, { status: 201, headers });
        } catch (error) {
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
