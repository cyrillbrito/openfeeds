import { getDb } from '@repo/db';
import { createSettings, sendPasswordResetEmail, sendVerificationEmail } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from '~/env';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: 'pg' }),
  trustedOrigins: [env.CLIENT_DOMAIN],
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
      // Rewrite callbackURL to /signin so the user lands on the app (not marketing site)
      // after clicking the verification link. Better Auth defaults to "/" which the
      // Cloudflare router sends to the marketing page.
      const verifyUrl = new URL(url);
      verifyUrl.searchParams.set('callbackURL', '/signin');
      await sendVerificationEmail(user.email, verifyUrl.toString());
    },
    sendOnSignUp: !env.SIMPLE_AUTH,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
});
