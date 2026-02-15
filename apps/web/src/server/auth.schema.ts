import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { SQL } from 'bun';

// This file is used only for schema generation (generate:auth-schema script).
// It must NOT import ~/env to avoid runtime env validation failures.

export const auth = betterAuth({
  database: drizzleAdapter(new SQL(''), { provider: 'pg' }),
  disabledPaths: ['/token'],
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
    jwt(),
    oauthProvider({
      loginPage: '/signin',
      consentPage: '/oauth/consent',
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true, // Required for MCP clients (public clients)
      scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
    }),
    tanstackStartCookies(),
  ],
});
