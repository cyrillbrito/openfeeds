import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api/client';

/**
 * Eden Treaty client — end-to-end typed access to the Elysia API in apps/api/.
 *
 * Migrated routes live under /api2/* (not /api/*) because TanStack Start's
 * Nitro middleware claims the /api namespace and blocks Vite's proxy. Once
 * Start is fully removed we can rename back to /api.
 *
 * Same-origin via Vite's `server.proxy: { '/api2': ... }`. No CORS, no cookie
 * domain issues, works over Tailscale tunnels.
 *
 * `import type` ensures none of Elysia/Better Auth/drizzle is bundled into
 * the client — only TypeScript types travel across the boundary.
 *
 * Usage:
 *   const { data, error } = await api.api2.feeds.index.post({ url: '...' });
 */
const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;

export const api = treaty<App>(origin, {
  fetch: {
    credentials: 'include',
  },
});
