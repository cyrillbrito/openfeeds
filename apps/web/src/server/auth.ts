import { oauthProvider } from '@better-auth/oauth-provider';
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
import { jwt } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start/solid';
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
  disabledPaths: ['/token'], // Disabled in favor of /oauth2/token from oauthProvider
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
  plugins: [
    tanstackStartCookies(),
    jwt(),
    oauthProvider({
      loginPage: '/signin',
      consentPage: '/oauth/consent',
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true, // Required for MCP clients (public clients)
      scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
      validAudiences: [`${env.TRUSTED_ORIGINS[0]}/api/mcp`], // TODO REVIEW
    }),
  ],
});
