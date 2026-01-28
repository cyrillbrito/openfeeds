import { z } from 'zod';

export const environment = z
  .object({
    CLIENT_DOMAIN: z.url(),
    BETTER_AUTH_SECRET: z.string(),
    ENABLE_CORS: z.stringbool().default(false),
    SIMPLE_AUTH: z.stringbool().default(false),
    POSTHOG_PUBLIC_KEY: z.string().default('phc_V6I0xn1Ptmx3QVqXzLNAK22H6D58kR3SJTYg1JdVEx'),
    DATABASE_URL: z.url(),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    RESEND_API_KEY: z.string().optional(),
    RESEND_AUDIENCE_ID: z.string().optional(),
  })
  .transform((env) => ({
    clientDomain: env.CLIENT_DOMAIN,
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    enableCors: env.ENABLE_CORS,
    simpleAuth: env.SIMPLE_AUTH,
    posthogPublicKey: env.POSTHOG_PUBLIC_KEY,
    databaseUrl: env.DATABASE_URL,
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    resendApiKey: env.RESEND_API_KEY,
    resendAudienceId: env.RESEND_AUDIENCE_ID,
  }))
  .parse(process.env);

console.log('### ENVIRONMENT ###', JSON.stringify(environment, null, 2));
