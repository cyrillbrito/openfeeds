import * as v from 'valibot';

// The typed env schema, probed by the plugin from the project root.
//
// `server` vars come through `virtual:env/server` (importing it from client
// code fails the build) and are read from process.env at BOOT, so secrets
// rotate without a rebuild and never appear in build artifacts. `client`
// vars need the VITE_ prefix and are baked into the bundle. Generated types
// land in solid-env.d.ts.
export default {
  server: {
    // Signs and encrypts Better Auth sessions and tokens; minimum 32
    // characters. Generate one: `openssl rand -base64 32`.
    BETTER_AUTH_SECRET: v.pipe(v.string(), v.minLength(32)),
    // The app's public origin. Better Auth builds the Google OAuth callback
    // URL from it; the default only works on localhost.
    BETTER_AUTH_URL: v.optional(v.string(), 'http://localhost:3000'),
    // Google sign-in. Both must be set for it to be enabled.
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),
    // Postgres connection string. The default matches compose.yml, so a
    // fresh clone is `docker compose up -d && bun run dev` with no .env
    // edit. Tests pass the literal 'memory://' and get in-process PGlite
    // (see src/server/db/index.ts).
    DATABASE_URL: v.optional(
      v.string(),
      'postgres://openfeeds:openfeeds@localhost:5432/openfeeds',
    ),
  },
  client: {
    VITE_APP_NAME: v.optional(v.pipe(v.string(), v.minLength(1)), 'Solid App'),
  },
};
