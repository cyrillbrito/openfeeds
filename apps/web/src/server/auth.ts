import { getDb } from '@repo/db';
import { sendPasswordResetEmail, sendVerificationEmail } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from '../env';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: 'pg' }),
  trustedOrigins: [env.VITE_CLIENT_DOMAIN],
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
