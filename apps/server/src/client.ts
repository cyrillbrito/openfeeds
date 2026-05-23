/**
 * Type-only re-export of the API surface for `hc<App>` consumers.
 *
 * Client code (apps/web/) imports `App` from here, never from `~/index.ts`,
 * so Better Auth, drizzle, @repo/domain etc. are never pulled into the
 * client bundle — only their types.
 */
export type { App } from './index';
