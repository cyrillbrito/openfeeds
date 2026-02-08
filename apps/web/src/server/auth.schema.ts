import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { SQL } from 'bun';
import { env } from '~/env';

export const auth = betterAuth({
  database: drizzleAdapter(new SQL(''), { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: env.SIMPLE_AUTH ? 5 : undefined,
  },
  emailVerification: {
    sendOnSignUp: true,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
});
