import { createFileRoute, redirect } from '@tanstack/solid-router';
import { $$hasAnyFeeds } from '~/entities/feeds.functions';
import { authGuard } from '~/lib/guards';

export const Route = createFileRoute('/')({
  beforeLoad: async (ctx) => {
    await authGuard(ctx.location);
  },
  loader: async () => {
    const hasFeeds = await $$hasAnyFeeds();
    throw redirect({ to: hasFeeds ? '/inbox' : '/discover' });
  },
});
