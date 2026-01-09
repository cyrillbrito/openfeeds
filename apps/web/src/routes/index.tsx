import { createFileRoute, useNavigate } from '@tanstack/solid-router';
import { useFeeds } from '~/entities/feeds';
import { authMiddleware } from '~/server/middleware/auth';
import { createEffect } from 'solid-js';

export const Route = createFileRoute('/')({
  server: {
    middleware: [authMiddleware],
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const feedsQuery = useFeeds();

  createEffect(() => {
    if (feedsQuery.status() === 'ready') {
      if (feedsQuery.data?.length) {
        navigate({ to: '/inbox', replace: true });
      } else {
        navigate({ to: '/feeds', replace: true });
      }
    }
  });

  return <></>;
}
