import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { jwt, lastLoginMethod } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start/solid';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// This file is used only for schema generation (generate:auth-schema script).
// It must NOT import ~/env to avoid runtime env validation failures.
// The postgres client is created with an empty string — it never actually connects.

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(postgres('')), { provider: 'pg' }),
  trustedOrigins: ['https://appleid.apple.com'],
  disabledPaths: ['/token'],
  user: {
    additionalFields: {
      plan: {
        type: 'string',
        required: false,
        defaultValue: 'free',
        input: false,
      },
    },
  },
  socialProviders: {
    google: {
      clientId: '',
      clientSecret: '',
    },
    apple: {
      clientId: '',
      clientSecret: '',
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
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
    }),
    tanstackStartCookies(),
  ],
});
