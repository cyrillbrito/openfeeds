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
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

let authInstance: ReturnType<typeof betterAuth> | null = null;

/**
 * Get or create the Better Auth instance with lazy initialization.
 *
 * During build/prerender, the database files don't exist at the expected paths
 * (build runs from .output/ but DBs are in ../../dbs/), causing file access errors.
 *
 * Solution: Use an in-memory SQLite database during prerender, real database at runtime.
 */
export function getAuth() {
  if (authInstance) return authInstance;

  // Check if we're in prerender/build mode
  // - NITRO_PRERENDER: Set by Nitro during prerendering
  // - PRERENDER: Alternative env var that might be set
  // - .output check: Fallback detection based on working directory
  const isPrerender =
    process.env.NITRO_PRERENDER === 'true' ||
    process.env.PRERENDER === 'true' ||
    process.cwd().includes('.output');

  // Use in-memory database during prerender, real database otherwise
  // :memory: creates a temporary SQLite database in RAM
  const database = isPrerender
    ? drizzleAdapter(drizzle(new Database(':memory:')), { provider: 'sqlite' })
    : drizzleAdapter(dbProvider.authDb(), { provider: 'sqlite' });

  // Create auth instance with appropriate database
  authInstance = betterAuth({
    database,
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

  return authInstance;
}
