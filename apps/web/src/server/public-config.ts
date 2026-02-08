import { createServerFn } from '@tanstack/solid-start';
import { env } from '~/env';

/** Public config exposed to the client at runtime. No auth required. */
export const $$getPublicConfig = createServerFn().handler(() => {
  return {
    posthogKey: env.POSTHOG_PUBLIC_KEY,
  };
});
