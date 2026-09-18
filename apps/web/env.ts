import * as v from 'valibot';

// The typed env schema (probed by the plugin from the project root): plain
// objects of Standard Schema validators — valibot here, but zod, arktype, or
// any compliant library works, even mixed per key.
//
// `server` vars come through `virtual:env/server` (server modules only —
// importing it from client code fails the build) and are read from
// process.env at BOOT, validated then: secrets rotate without a rebuild and
// never appear in build artifacts. `client` vars must carry the public
// VITE_ prefix and come through `virtual:env/client` as validated values
// baked into the bundle. Generated types land in solid-env.d.ts.
export default {
  server: {
    // Comma-separated, newest first — see src/server/session.ts for the
    // rotation story. Generate one: `openssl rand -base64 32`.
    SESSION_SECRET: v.pipe(v.string(), v.minLength(32)),
    // Where the SQLite file lives. The default keeps the "one container, one
    // file" story honest: `docker run -v ./data:/data openfeeds`.
    DATABASE_PATH: v.optional(v.string(), './data/openfeeds.db'),
    // Development-only: stall every server function in the data layer by
    // this many milliseconds so loading states are visible on localhost.
    // See src/server/dev-delay.ts; ignored entirely in a production build.
    SYNTHETIC_DELAY_MS: v.optional(v.string(), '0'),
  },
  client: {
    VITE_APP_NAME: v.optional(v.pipe(v.string(), v.minLength(1)), 'Solid App'),
  },
};
