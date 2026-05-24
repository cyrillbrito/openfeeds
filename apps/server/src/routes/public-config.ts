import { Hono } from 'hono';
import { env } from '~/env';
import type { Env } from '~/middleware/auth';

/**
 * Public runtime config exposed to the web client. No auth required.
 * Web fetches this once at root-route boot and caches the result client-side.
 */
export const publicConfigRoutes = new Hono<Env>().get('/config', (c) =>
  c.json({
    posthogKey: env.POSTHOG_PUBLIC_KEY,
    socialProviders: {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      apple: Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET),
    },
  }),
);
