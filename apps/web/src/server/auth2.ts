/**
 * Better Auth configuration for CLI schema generation and runtime.
 * Creates its own DB connection so it can be imported without initDb().
 */
import { sendPasswordResetEmail, sendVerificationEmail } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';

// Create DB connection directly (for CLI compatibility)
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/openfeeds';
const client = new SQL(connectionString);
const db = drizzle(client);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  trustedOrigins: process.env.CLIENT_DOMAIN ? [process.env.CLIENT_DOMAIN] : [],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.SIMPLE_AUTH !== 'true',
    minPasswordLength: process.env.SIMPLE_AUTH === 'true' ? 5 : undefined,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: process.env.SIMPLE_AUTH !== 'true',
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
});
