import { getUserDb, type UserDb } from '@repo/db';
import { UnauthorizedError } from '@repo/domain';
import { Elysia } from 'elysia';
import { auth, type AuthSession, type AuthUser } from './auth';

export const authPlugin = new Elysia({ name: 'auth' }).resolve(
  { as: 'scoped' },
  async ({ headers, set }) => {
    const session = await auth().api.getSession({
      headers: new Headers(headers as Record<string, string>),
    });

    if (!session) {
      set.status = 401;
      throw new UnauthorizedError();
    }

    return {
      user: session.user as AuthUser,
      session: session.session as AuthSession,
      db: getUserDb(session.user.id) as UserDb,
    };
  },
);
