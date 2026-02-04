import { createAuthClient } from 'better-auth/solid';
import { env } from '~/env';

// Auth client configuration:
// - Server-side (SSR/beforeLoad): Uses CLIENT_DOMAIN env var
// - Client-side (browser): Uses window.location.origin (Better Auth's default)

export const authClient = createAuthClient({
  baseURL: window ? undefined : env.CLIENT_DOMAIN,
});
