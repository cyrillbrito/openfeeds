// The server middleware chain (wired via `start.middleware` in
// vite.config.ts): fetch-style functions fronting every request the server
// dispatches — page renders, server function calls, and API routes alike.
// Each runs inside the request-event scope, so getRequestEvent() (and the
// session helpers built on it) work here exactly as in application code.
import { createAPIHandler } from 'filesystem-routing/api';
import routes from 'virtual:file-routes';

import { auth } from './server/auth';
import { startFeedCron } from './server/cron';

// This module is evaluated once when the server boots — dev middleware and
// production handler alike — which makes it the app's server lifecycle hook.
// The feed sweep starts here rather than in server.js so that `bun run dev`
// fetches feeds too. startFeedCron() is idempotent (see server/cron.ts).
startFeedCron();

/**
 * Send anonymous visitors to /signin before a page renders.
 *
 * Only document requests: a server function or an asset gets no redirect,
 * and the data layer refuses those itself (server/require-user.ts). This is
 * navigation, not authorization — the queries are the boundary that
 * actually keeps one user's rows away from another.
 *
 * It has to happen here rather than in a route guard because the app shell
 * reads the user's feeds on every page: by the time a component could
 * redirect, the query has already thrown inside a <Loading> boundary and
 * the render is beyond saving.
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
// (see src/routes/api) and passes everything else down the chain.
export default [
  async (request: Request, next: (request?: Request) => Response | Promise<Response>) =>
    (await requireSignIn(request)) ?? next(request),
  createAPIHandler(routes),
];
