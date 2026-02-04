import { createAuthClient } from 'better-auth/solid';
import { env } from '~/env';

// Auth client configuration:
// - Server-side (SSR/beforeLoad): Uses CLIENT_DOMAIN env var
// - Client-side (browser): Uses window.location.origin (Better Auth's default)
//
// Must use typeof check - direct `window` access throws ReferenceError in SSR
const isServer = typeof globalThis.window === 'undefined';

export const authClient = createAuthClient({
  baseURL: isServer ? env.CLIENT_DOMAIN : undefined,
});
