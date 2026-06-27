import { zValidator } from '@hono/zod-validator';
import { addContactToWaitlist } from '@repo/domain';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

// In-memory fixed-window rate limiter for this anonymous, Resend-backed
// endpoint. Cloudflare's WAF is the first line of defense; this process-local
// limiter is defense-in-depth in case the origin VPS is reached directly,
// bounding both mailing-list spam and Resend quota burn. Single-replica
// deployment (see docs/migration-architecture.md) makes in-memory state
// sufficient — no shared store needed.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(c: Context): boolean {
  // Only trust Cloudflare's client IP header. If the origin is reached
  // directly, don't let spoofed forwarding headers bypass the limiter.
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const now = Date.now();

  // Opportunistically evict expired buckets so the map can't grow unbounded
  // under a flood of distinct keys.
  if (rateLimitBuckets.size > 10_000) {
    for (const [key, bucket] of rateLimitBuckets) {
      if (now > bucket.resetAt) rateLimitBuckets.delete(key);
    }
  }

  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return true;
  bucket.count += 1;
  return false;
}

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
  (c, next) => {
    if (isRateLimited(c)) {
      return c.json({ success: false, error: 'Too many requests. Please try again later.' }, 429);
    }
    return next();
  },
  zValidator('json', z.object({ email: z.email() }), (result, c) => {
    if (!result.success) {
      return c.json({ success: false, error: 'Invalid email address' }, 400);
    }
    return undefined;
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
