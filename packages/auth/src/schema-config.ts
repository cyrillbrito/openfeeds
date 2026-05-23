import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { jwt, lastLoginMethod } from 'better-auth/plugins';
import { SQL } from 'bun';

// Env-free mirror used only by `@better-auth/cli` (see packages/db `generate:auth-schema`).
// Keep plugin set in sync with createAuth() in src/index.ts.

export const auth = betterAuth({
  database: drizzleAdapter(new SQL(''), { provider: 'pg' }),
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
      allowUnauthenticatedClientRegistration: true,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
    }),
  ],
});
