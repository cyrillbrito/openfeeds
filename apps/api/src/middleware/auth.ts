import { Elysia } from 'elysia';
import { auth, type AuthSession } from '~/auth';

/**
 * Auth plugin — exposes `user` + `session` on the request context.
 *
 * Usage:
 *   app.use(authPlugin).get('/me', ({ user }) => user)
 *
 * Routes that require auth should call `requireUser(user)` or use a guard.
 */
export const authPlugin = new Elysia({ name: 'auth' }).derive(
  { as: 'global' },
  async ({
    request,
  }): Promise<{ user: AuthSession['user'] | null; session: AuthSession['session'] | null }> => {
    try {
      const result = await auth.api.getSession({ headers: request.headers });
      if (!result) return { user: null, session: null };
      return { user: result.user, session: result.session };
    } catch {
      // Surfaces as 500 if the route requires the user; otherwise treated as guest.
      return { user: null, session: null };
    }
  },
);

/**
 * Throws an Elysia 401 if user is missing. Use at the top of handlers that require auth.
 */
export function requireUser(user: AuthSession['user'] | null): asserts user is AuthSession['user'] {
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
