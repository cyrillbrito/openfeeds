import { oauthProvider } from '@better-auth/oauth-provider';
import { db } from '@repo/db';
import {
  createSettings,
  sendPasswordResetEmail,
  sendVerificationEmail,
  trackEvent,
} from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { jwt, lastLoginMethod } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start/solid';
import { env } from '~/env';

export const auth = betterAuth({
  baseURL: env.BASE_URL,
  database: drizzleAdapter(db, { provider: 'pg' }),
  trustedOrigins: [...env.TRUSTED_ORIGINS, 'https://appleid.apple.com'],
  // Required by oauthProvider — the plugin provides its own /token endpoint
  disabledPaths: ['/token'],
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }),
    ...(env.APPLE_CLIENT_ID &&
      env.APPLE_CLIENT_SECRET && {
        apple: {
          clientId: env.APPLE_CLIENT_ID,
          clientSecret: env.APPLE_CLIENT_SECRET,
        },
      }),
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;

      if (ctx.path === '/sign-up/email') {
        trackEvent(newSession.user.id, 'auth:account_create', { method: 'email' });
      } else if (ctx.path === '/sign-in/email') {
        trackEvent(newSession.user.id, 'auth:session_create', { method: 'email' });
      } else if (ctx.path === '/callback/google') {
        trackEvent(newSession.user.id, 'auth:session_create', { method: 'google' });
      } else if (ctx.path === '/callback/apple') {
        trackEvent(newSession.user.id, 'auth:session_create', { method: 'apple' });
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
    storeSessionInDatabase: true,
  },
  plugins: [
    jwt({ disableSettingJwtHeader: true }),
    lastLoginMethod(),
    oauthProvider({
      loginPage: '/login',
      consentPage: '/oauth/consent',
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true, // Required for MCP clients (public clients)
      scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
      validAudiences: [`${env.BASE_URL}/api/mcp`],
    }),
    tanstackStartCookies(),
  ],
});
