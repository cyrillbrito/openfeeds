import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { auth } from '~/auth';
import { env } from '~/env';
import { AuthError } from '~/middleware/auth';
import { chatRoutes } from '~/routes/chat';
import { feedsRoutes } from '~/routes/feeds';
import { shapesRoutes } from '~/routes/shapes';

/**
 * apps/api — Bun + Elysia prototype.
 *
 * Dev: web (Vite, :3000) calls this server cross-origin on :3001. CORS with
 * credentials enabled below so the shared Better Auth session cookie is sent.
 * Production target: same-origin via reverse proxy, then CORS becomes unused.
 *
 * Type export: `export type App = typeof app` enables end-to-end type safety
 * via Eden Treaty in apps/web/.
 */
const app = new Elysia()
  // Prototype: log every incoming request for debugging the migration.
  // Body logging intentionally omitted — auth routes carry plaintext
  // credentials. Remove once the prototype is validated.
  .onRequest(({ request }) => {
    console.log(`[api] → ${request.method} ${new URL(request.url).pathname}`);
  })

  // CORS — dev only really matters here. Origin is the web dev server.
  // `credentials: true` requires an explicit origin (not `*`) so the browser
  // accepts the Better Auth session cookie.
  .use(
    cors({
      origin: env.TRUSTED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  // Better Auth handles its own routes. Mounted under /api2/auth/* so it
  // doesn't conflict with web's Start-owned /api/auth/* (which the browser
  // still uses for login). Elysia's instance shares DB + secret, so cookies
  // issued by either app are accepted here for reading the session.
  .all('/api2/auth/*', ({ request }) => auth.handler(request))

  // Domain routes
  .use(shapesRoutes)
  .use(feedsRoutes)
  .use(chatRoutes)

  // Error mapping
  .onError(({ error, code, set, request, path }) => {
    console.log(`[api] ✗ ${request.method} ${path} → ${code}`, error);
    if (error instanceof AuthError) {
      set.status = error.status;
      return { message: error.message };
    }
    if (code === 'VALIDATION') {
      set.status = 422;
      return {
        message: 'Invalid request body',
        // Surface Elysia's detailed validation error in dev so the client can
        // see exactly which field failed.
        detail: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
    console.error('[api] Unhandled error', error);
    set.status = 500;
    return { message: 'Internal server error' };
  })

  .listen(env.API_PORT);

console.log(`🚀 api listening on http://localhost:${env.API_PORT}`);

export type App = typeof app;
