import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { createAuthClient } from 'better-auth/solid';
import { isServer } from 'solid-js/web';
import { env } from '~/env';

// Auth client configuration:
// - Server-side (SSR/beforeLoad): Uses first TRUSTED_ORIGINS entry as base URL
// - Client-side (browser): Uses window.location.origin (Better Auth's default)

export const authClient = createAuthClient({
  baseURL: isServer ? env.TRUSTED_ORIGINS[0] : undefined,
  plugins: [oauthProviderClient()],
});
