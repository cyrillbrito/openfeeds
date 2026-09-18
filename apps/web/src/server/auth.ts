// Better Auth instance. Email + password is always enabled; Google is
// enabled when both of its env vars are set.
//
// Email verification and password reset are off: they need an SMTP server,
// and there is no mailer yet. Magic link is not installed for the same
// reason.
import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from 'virtual:env/server';

import { db } from './db';

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }
    : undefined;

/** Whether the sign-in page should offer "Continue with Google". */
export const googleEnabled = google !== undefined;

export const auth = betterAuth({
  // The adapter reads the `user`/`session`/`account`/`verification` tables
  // from src/server/db/schema.ts and validates they exist at first use.
  database: drizzleAdapter(db, { provider: 'pg' }),

  // Better Auth builds the OAuth callback URL from this.
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: google ? { google } : undefined,
});
