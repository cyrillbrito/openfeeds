import { getDb } from '@repo/db';
import { sendPasswordResetEmail, sendVerificationEmail } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { environment } from './environment';

// Factory so TypeScript can infer BetterAuth's full type
function createBetterAuth(): ReturnType<typeof betterAuth> {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: 'pg' }),
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
    basePath: 'auth',
    trustedOrigins: [environment.clientDomain],
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}

// Holds the singleton auth instance
let _auth: ReturnType<typeof createBetterAuth> | undefined;

// Lazy init: create once, reuse everywhere
export function auth(): ReturnType<typeof createBetterAuth> {
  return (_auth ??= createBetterAuth());
}

// Types for accessing auth context in apps
export type AuthUser = ReturnType<typeof auth>['$Infer']['Session']['user'];
export type AuthSession = ReturnType<typeof auth>['$Infer']['Session']['session'];
