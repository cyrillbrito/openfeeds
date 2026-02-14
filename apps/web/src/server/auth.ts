import { getDb } from '@repo/db';
import {
  createSettings,
  sendPasswordResetEmail,
  sendVerificationEmail,
  trackEvent,
} from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from '~/env';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: 'pg' }),
  trustedOrigins: env.TRUSTED_ORIGINS,
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;

      if (ctx.path === '/sign-up/email') {
        trackEvent(newSession.user.id, 'auth:account_create', { method: 'email' });
      } else if (ctx.path === '/sign-in/email') {
        trackEvent(newSession.user.id, 'auth:session_create', { method: 'email' });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create default settings for new users
          await createSettings(user.id);
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: !env.SIMPLE_AUTH,
    minPasswordLength: env.SIMPLE_AUTH ? 5 : undefined,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: !env.SIMPLE_AUTH,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
});
