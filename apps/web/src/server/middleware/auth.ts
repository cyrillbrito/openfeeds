import { redirect } from '@tanstack/solid-router';
import { createMiddleware } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import { getAuth } from '../auth';

export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const headers = getRequestHeaders();
  const session = await getAuth().api.getSession({ headers });
  if (!session) {
    const url = new URL(request.url);
    throw redirect({
      to: '/signin',
      search: { redirect: url.pathname + url.search },
    });
  }
  return next({ context: { user: session.user, session: session.session } });
});
