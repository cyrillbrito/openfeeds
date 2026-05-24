import { runMigrations } from '@repo/db';
import {
  BadRequestError,
  ConflictError,
  handleBoundaryError,
  LimitExceededError,
  NotFoundError,
  TtsNotConfiguredError,
  UnauthorizedError,
} from '@repo/domain';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { auth } from '~/auth';
import { env } from '~/env';
import type { Env } from '~/middleware/auth';
import { actionsRoutes } from '~/routes/actions';
import { articleAudioRoutes } from '~/routes/article-audio';
import { articleTagsRoutes } from '~/routes/article-tags';
import { articlesRoutes } from '~/routes/articles';
import { chatRoutes } from '~/routes/chat';
import { chatSessionsRoutes } from '~/routes/chat-sessions';
import { feedTagsRoutes } from '~/routes/feed-tags';
import { feedsRoutes } from '~/routes/feeds';
import { filterRulesRoutes } from '~/routes/filter-rules';
import { mcpRoutes } from '~/routes/mcp';
import { publicConfigRoutes } from '~/routes/public-config';
import { settingsRoutes } from '~/routes/settings';
import { shapesRoutes } from '~/routes/shapes';
import { tagsRoutes } from '~/routes/tags';
import { wellKnownRoutes } from '~/routes/well-known';

/**
 * apps/server — Bun + Hono.
 *
 * Dev: web (Vite, :3400) calls this server cross-origin on :3401. CORS with
 * credentials enabled below so the shared Better Auth session cookie is sent.
 * Production: this same process also serves the built SPA from ./web-dist
 * (see SPA fallback at the bottom of this file) on :3000, so the browser
 * sees one origin and CORS is unused.
 *
 * Type export: `export type App = typeof app` enables end-to-end type safety
 * via Hono's `hc<App>` client in apps/web/.
 *
 * IMPORTANT: every route and `.route()` mount MUST be chained on the same
 * `app` reference. Splitting routes across reassigned variables breaks the
 * RPC type inference. See "Hono Client (RPC)" in the hono skill.
 */

// Apply pending DB migrations before the server starts accepting traffic.
// Single-replica deployment, so no writer-race. A failed migration throws,
// the process exits non-zero, and the deploy fails loudly. For out-of-band
// migrations (e.g. CREATE INDEX CONCURRENTLY) use `bun migrate` directly
// against the prod DB without redeploying. See docs/migration-architecture.md.
await runMigrations();

const app = new Hono<Env>()
  // CORS — dev only really matters here. Origin is the web dev server.
  // `credentials: true` requires an explicit origin (not `*`) so the browser
  // accepts the Better Auth session cookie.
  .use(
    '*',
    cors({
      origin: env.TRUSTED_ORIGINS,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  // Better Auth handles its own routes under /api/auth/*. Auth is the single
  // source of truth for this app — cookies it issues are valid everywhere.
  .all('/api/auth/*', (c) => auth.handler(c.req.raw))

  // Domain routes. Mount paths are baked in here (not in the child routers)
  // so the child routers stay portable.
  .route('/api/shapes', shapesRoutes)
  .route('/api/feeds', feedsRoutes)
  .route('/api/articles', articlesRoutes)
  .route('/api/article-tags', articleTagsRoutes)
  .route('/api/article-audio', articleAudioRoutes)
  .route('/api/tags', tagsRoutes)
  .route('/api/feed-tags', feedTagsRoutes)
  .route('/api/filter-rules', filterRulesRoutes)
  .route('/api/settings', settingsRoutes)
  .route('/api/chat-sessions', chatSessionsRoutes)
  .route('/api/actions', actionsRoutes)
  .route('/api/chat', chatRoutes)
  // RFC 8615 / OpenID Discovery mandates root-level paths under /.well-known/*
  .route('/.well-known', wellKnownRoutes)
  .route('/api/mcp', mcpRoutes)
  .route('/api/public-config', publicConfigRoutes);

// SPA serving (prod only). In dev the web Vite server on :3400 owns the
// browser origin and proxies /api/* here, so we don't want this app to
// shadow Vite's HMR. In prod the Docker image copies the built SPA into
// ./web-dist alongside this server, and Hono serves it: static assets
// first, then `index.html` for any unmatched route (deep links, refreshes).
//
// SERVE_SPA is set by the prod Dockerfile. Order matters: this MUST come
// after all /api/* and /.well-known/* mounts so they win over the SPA fallback.
if (env.SERVE_SPA) {
  app.use('/assets/*', serveStatic({ root: './web-dist' }));
  app.get('/favicon.ico', serveStatic({ path: './web-dist/favicon.ico' }));
  // SPA fallback — any non-API GET returns index.html so client-side
  // routing (TanStack Router) handles the URL.
  app.get('*', serveStatic({ path: './web-dist/index.html' }));
}

// Error mapping — runs for any thrown error or HTTPException. Validation
// errors from @hono/zod-validator return 400 automatically with a default
// body; HTTPException(401) from `requireAuthMiddleware` lands here too.
//
// Domain errors are transport-agnostic (see packages/domain/AGENTS.md) — we
// map them to HTTP here so route handlers stay free of try/catch noise.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }

  // Domain error mapping. Messages are user-safe by construction.
  if (err instanceof UnauthorizedError) {
    return c.json({ message: err.message }, 401);
  }
  if (err instanceof NotFoundError) {
    return c.json({ message: err.message }, 404);
  }
  if (err instanceof ConflictError) {
    return c.json({ message: err.message }, 409);
  }
  if (err instanceof BadRequestError) {
    return c.json({ message: err.message }, 400);
  }
  if (err instanceof LimitExceededError) {
    return c.json({ message: err.message, resource: err.resource, limit: err.limit }, 429);
  }
  if (err instanceof TtsNotConfiguredError) {
    return c.json({ message: err.message }, 503);
  }

  // Unknown — capture and return a sanitized response. Path/user context is
  // best-effort: c.var.user may not be set on routes that don't require auth.
  handleBoundaryError(err, {
    source: 'api-route',
    operation: `${c.req.method} ${new URL(c.req.url).pathname}`,
    userId: c.var.user?.id,
  });
  return c.json({ message: 'Internal server error' }, 500);
});

console.log(`🚀 server listening on http://localhost:${env.SERVER_PORT}`);

export default {
  port: env.SERVER_PORT,
  fetch: app.fetch,
};

export type App = typeof app;
