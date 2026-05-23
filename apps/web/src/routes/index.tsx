import { createFileRoute, redirect } from '@tanstack/solid-router';
import { api, unwrap } from '~/lib/api-client';
import { authGuard } from '~/lib/guards';

export const Route = createFileRoute('/')({
  beforeLoad: async (ctx) => {
    await authGuard(ctx.location);
  },
  loader: async () => {
    const { hasAny } = await unwrap(api.api.feeds['has-any'].$get({}));
    throw redirect({ to: hasAny ? '/inbox' : '/discover' });
  },
});
