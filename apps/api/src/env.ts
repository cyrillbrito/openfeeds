import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_PORT: z.coerce.number().default(3401),
    /**
     * When true, this server also serves the built SPA from ./web-dist
     * (assets + index.html fallback). Set in the prod Docker image. Off in
     * dev so Vite (on :3400) owns the browser origin and HMR works.
     */
    SERVE_SPA: z.stringbool().default(false),
    /**
     * Public origin that external clients use to reach this API. In dev
     * this is typically the web Vite server (http://localhost:3400), which
     * proxies /api/* → :3401 — so browsers, MCP clients, and OAuth flows
     * see one origin. In prod this is whatever public hostname terminates
     * TLS in front of the api app (which also serves the SPA — same origin).
     */
    BASE_URL: z.url(),
    /**
     * JWKS endpoint used by the MCP handler to verify access-token JWTs.
     * Defaults to `${BASE_URL}/api/auth/jwks`. Override (e.g. to an
     * internal http://localhost:3401/api/auth/jwks) to bypass DNS/TLS or
     * avoid an extra network hop for the self-fetch.
     */
    AUTH_JWKS_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string(),
    SIMPLE_AUTH: z.stringbool().default(false),
    TRUSTED_ORIGINS: z
      .string()
      .transform((val) => val.split(',').map((s) => s.trim()))
      .pipe(z.array(z.url())),
    // Electric SQL
    ELECTRIC_URL: z.string().default('http://localhost:3406'),
    ELECTRIC_SOURCE_ID: z.string().optional(),
    ELECTRIC_SOURCE_SECRET: z.string().optional(),
    // Social providers (optional)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    // Public config exposed to the web client via /api/public-config.
    POSTHOG_PUBLIC_KEY: z.string().optional(),
    // AI
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z
      .enum(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'])
      .default('claude-haiku-4-5'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    throw new Error(`Invalid environment variables: ${JSON.stringify(issues, null, 2)}`);
  },
});
