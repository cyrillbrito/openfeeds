import { getDb } from '@repo/db';
import { sendPasswordResetEmail, sendVerificationEmail } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../env';

let authInstance: ReturnType<typeof betterAuth> | null = null;

/**
 * Check if we're in prerender/build mode.
 * During build/prerender, the database connection might not be available.
 */
function isPrerender(): boolean {
  return (
    process.env.NITRO_PRERENDER === 'true' ||
    process.env.PRERENDER === 'true' ||
    process.cwd().includes('.output')
  );
}

/**
 * Get or create the Better Auth instance with lazy initialization.
 *
 * During build/prerender, use an in-memory SQLite database as a dummy
 * since the real PostgreSQL database may not be available.
 */
export function getAuth() {
  if (authInstance) return authInstance;

  // Use in-memory SQLite during prerender, real PostgreSQL otherwise
  const database = isPrerender()
    ? drizzleAdapter(drizzle(new Database(':memory:')), { provider: 'sqlite' })
    : drizzleAdapter(getDb(), { provider: 'pg' });

  authInstance = betterAuth({
    database,
    trustedOrigins: [env.CLIENT_DOMAIN],
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

  return authInstance;
}
