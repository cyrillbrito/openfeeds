import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SERVER_PORT: z.coerce.number().default(3401),
    /**
     * Public origin that external clients use to reach this API. In dev
     * this is typically the web Vite server (http://localhost:3400), which
     * proxies /api/* → :3401 — so browsers, MCP clients, and OAuth flows
     * see one origin. In prod this is whatever public hostname terminates
     * TLS in front of the server (which also serves the SPA — same origin).
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
    /**
     * Comma-separated list of fully-qualified extension origins allowed to
     * call the public `POST /api/feeds` endpoint with credentials. Each
     * entry must be a full origin including scheme + extension id, e.g.
     * `chrome-extension://abcdefghijklmnop,moz-extension://uuid-here`.
     *
     * Why specific IDs (not `chrome-extension://*`): any extension the user
     * installs would otherwise be able to send credentialed cross-origin
     * requests with the browser's cookies attached. Pinning the published
     * extension id closes that surface.
     */
    EXTENSION_ORIGINS: z
      .string()
      .optional()
      .default('')
      .transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(
        z.array(
          z
            .string()
            .refine(
              (s) => s.startsWith('chrome-extension://') || s.startsWith('moz-extension://'),
              {
                message: 'Extension origin must start with chrome-extension:// or moz-extension://',
              },
            ),
        ),
      ),
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

/**
 * Cross-field invariant: Electric Cloud requires BOTH `source_id` and
 * `source_secret` (the proxy forwards them as a pair). Open-source Electric
 * accepts NEITHER. Anything in between is a misconfiguration that would
 * surface as 401s from Electric or, worse, as the literal string
 * `'undefined'` being sent as the secret. Fail loud at boot instead.
 */
if (Boolean(env.ELECTRIC_SOURCE_ID) !== Boolean(env.ELECTRIC_SOURCE_SECRET)) {
  throw new Error(
    'ELECTRIC_SOURCE_ID and ELECTRIC_SOURCE_SECRET must be set together or not at all.',
  );
}
