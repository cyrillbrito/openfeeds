// The server middleware chain (wired via `start.middleware` in
// vite.config.ts), fronting every request: page renders, server function
// calls and API routes alike. Each runs inside the request-event scope, so
// getRequestEvent() works here as it does in application code.
import { createAPIHandler } from 'filesystem-routing/api';
import routes from 'virtual:file-routes';

import { auth } from './server/auth';
import { startFeedCron } from './server/cron';

// Evaluated once at boot, dev and production alike, which makes this the
// app's server lifecycle hook. The sweep starts here rather than in
// server.js so `bun run dev` fetches feeds too; the call is idempotent.
startFeedCron();

/**
 * Send anonymous visitors to /signin before a page renders. Navigation, not
 * authorization — server/require-user.ts is what actually keeps one user's
 * rows away from another, and it covers the server functions this skips.
 *
 * Here rather than in a route guard because the shell reads the user's
 * feeds on every page: by the time a component could redirect, the query
 * has already thrown inside a <Loading> boundary.
 */
async function requireSignIn(request: Request): Promise<Response | undefined> {
  if (!request.headers.get('accept')?.includes('text/html')) return;

  const { pathname } = new URL(request.url);
  if (pathname === '/signin' || pathname.startsWith('/api/auth/')) return;

  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return;

  return new Response(null, { status: 302, headers: { location: '/signin' } });
}

// createAPIHandler serves the GET/POST/... exports of route modules
// (src/routes/api) and passes everything else down the chain.
export default [
  async (request: Request, next: (request?: Request) => Response | Promise<Response>) =>
    (await requireSignIn(request)) ?? next(request),
  createAPIHandler(routes),
];
