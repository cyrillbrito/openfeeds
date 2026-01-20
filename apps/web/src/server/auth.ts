import { createUserDb } from '@repo/db';
import {
  dbProvider,
  environment,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

export const auth = betterAuth({
  database: drizzleAdapter(dbProvider.authDb(), { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: !environment.simpleAuth,
    minPasswordLength: environment.simpleAuth ? 5 : undefined,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: !environment.simpleAuth,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith('/sign-up')) {
        const newSession = ctx.context.newSession;
        if (newSession?.user.id) {
          await createUserDb(dbProvider, newSession.user.id);
        }
      }
    }),
  },
});
