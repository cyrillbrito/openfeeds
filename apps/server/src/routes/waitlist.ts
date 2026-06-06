import { zValidator } from '@hono/zod-validator';
import { addContactToWaitlist } from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';

// Marketing waitlist signup. Anonymous (no auth) and same-origin only:
// the marketing site is served from this same server in prod, so the
// global CORS policy (env.TRUSTED_ORIGINS) is exactly what we want.
//
// Response shape kept compatible with the previous Astro endpoint
// (`{ success: true } | { success: false, error: string }`) so the
// SubscribeForm's parsing logic doesn't change. The default zValidator
// hook returns a Zod issue tree on validation failure, which would
// surface as `[object Object]` in the form — the custom `result` hook
// below collapses that to a single user-safe string.
export const waitlistRoutes = new Hono().post(
  '/',
  zValidator('json', z.object({ email: z.email() }), (result, c) => {
    if (!result.success) {
      return c.json({ success: false, error: 'Invalid email address' }, 400);
    }
  }),
  async (c) => {
    const { email } = c.req.valid('json');
    const result = await addContactToWaitlist(email);
    if (!result.success) {
      return c.json(result, 500);
    }
    return c.json(result);
  },
);
