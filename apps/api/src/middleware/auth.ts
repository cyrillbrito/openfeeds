import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { auth, type AuthSession } from '~/auth';

/**
 * Variables exposed by `authMiddleware` on Hono's context. Every route gets
 * `user` and `session`, both nullable. Use `requireUser(c.var.user)` inside
 * handlers that require auth.
 *
 * Use this `Env` everywhere a Hono instance, middleware, or handler is
 * defined (`new Hono<Env>()`, `createMiddleware<Env>(...)`) so context types
 * line up across the app.
 */
export type AuthVariables = {
  user: AuthSession['user'] | null;
  session: AuthSession['session'] | null;
};

export type Env = {
  Variables: AuthVariables;
};

/**
 * Reads the Better Auth session from the request cookie and stores user +
 * session on the context. Always runs — routes that require auth call
 * `requireUser` to assert non-null.
 *
 * Errors from the auth provider are swallowed and treated as guest — same as
 * the previous Elysia behaviour. A failure to read the session shouldn't 500
 * the entire request; missing user surfaces as 401 only when a handler asks
 * for one.
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
 * Asserts the request is authenticated. Throws `HTTPException(401)` if not,
 * which the central `app.onError` in `src/index.ts` maps to the standard
 * `{ message }` error body.
 */
export function requireUser(user: AuthSession['user'] | null): asserts user is AuthSession['user'] {
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
}
