import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { articlesApp } from './apps/articles';
import { articleTagsApp } from './apps/article-tags';
// import { authApp } from './apps/auth';
import { feedsApp } from './apps/feeds';
import { filterRulesApp } from './apps/filter-rules';
import { importApp } from './apps/import';
import { settingsApp } from './apps/settings';
import { tagsApp } from './apps/tags';
import { auth } from './auth';
import { environment } from './environment';
import { logger } from './utils/logger';

// Build app with full method chaining for proper type inference
export const apiApp = new Elysia({ prefix: '/api' })
  .use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
  .onRequest(({ request }) => {
    console.log(`${request.method} ${new URL(request.url).pathname}`);
  })
  // CORS Configuration
  .use(
    cors({
      origin: environment.enableCors ? environment.clientDomain : '*',
      credentials: true,
      maxAge: 86400,
    }),
  )
  // Better Auth handler (no mount for type inference)
  .all('/auth/*', ({ request }) => auth().handler(request))
  // Mount all route apps
  .use(tagsApp)
  .use(feedsApp)
  .use(articlesApp)
  .use(articleTagsApp)
  .use(importApp)
  .use(settingsApp)
  .use(filterRulesApp)
  // Global error handler - last resort for catastrophic errors not handled by app-level error handlers
  .onError(({ error, set, request }) => {
    const url = new URL(request.url);
    logger.error(error instanceof Error ? error : new Error(`Non-Error thrown: ${String(error)}`), {
      path: url.pathname,
      method: request.method,
      root: true,
      message: 'UNEXPECTED: Error reached top-level handler - app-level handlers should catch this',
    });
    set.status = 500;
    return { error: 'Internal server error' };
  });
