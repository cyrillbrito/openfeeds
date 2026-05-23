import { createAuth } from '@repo/auth';
import { tanstackStartCookies } from 'better-auth/tanstack-start/solid';

// `tanstackStartCookies()` pipes Set-Cookie headers from server-side `auth.api.*`
// calls through Start's response builder. No-op when going through `auth.handler`.
// Deleted with Start at step 8 of docs/records/011-migrate-server-to-elysia.md.
export const auth = createAuth({
  extraPlugins: [tanstackStartCookies()],
});
