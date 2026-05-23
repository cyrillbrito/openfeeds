import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { auth, type AuthSession } from '~/auth';

/**
 * Two flavours of auth context:
 *
 * - `Env` — `user` and `session` may be null. Use on routers that have
 *   public endpoints, mounted under `authMiddleware`.
 * - `AuthedEnv` — `user` and `session` are guaranteed non-null. Use on
 *   routers (or sub-chains) mounted under `requireAuthMiddleware`; handlers
 *   get narrowed types without an explicit assertion.
 *
 * 99% of routes require auth — reach for `AuthedEnv` + `requireAuthMiddleware`
 * by default. Use `Env` + `authMiddleware` only when a router genuinely mixes
 * public and protected handlers (e.g. `article-audio.ts`'s `/available`).
 */
export type AuthVariables = {
  user: AuthSession['user'] | null;
  session: AuthSession['session'] | null;
};

export type Env = {
  Variables: AuthVariables;
};

export type AuthedVariables = {
  user: AuthSession['user'];
  session: AuthSession['session'];
};

export type AuthedEnv = {
  Variables: AuthedVariables;
};

/**
 * Reads the Better Auth session and stores user + session (nullable) on the
 * context. Never throws — auth-provider failures surface as guest, and
 * missing-session is just `user: null` for routes that allow it.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  try {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    if (result) {
      c.set('user', result.user);
      c.set('session', result.session);
    } else {
      c.set('user', null);
      c.set('session', null);
    }
  } catch {
    c.set('user', null);
    c.set('session', null);
  }
  await next();
});

/**
 * Asserting variant. Reads the session and throws `HTTPException(401)` if
 * absent. Downstream handlers get non-null `user`/`session` via `AuthedEnv`.
 * Auth-provider failures still surface as 401 (treated as guest first, then
 * rejected) rather than 500.
 */
export const requireAuthMiddleware = createMiddleware<AuthedEnv>(async (c, next) => {
  let result: AuthSession | null = null;
  try {
    result = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch {
    result = null;
  }
  if (!result) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});
