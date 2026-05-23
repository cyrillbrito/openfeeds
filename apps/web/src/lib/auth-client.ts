import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/solid';

// SPA — baseURL is always the browser origin (Vite dev server proxies
// /api/auth/* to the api server on :3401; in prod, web and api share a
// reverse-proxied origin).
export const authClient = createAuthClient({
  plugins: [oauthProviderClient(), lastLoginMethodClient()],
});
