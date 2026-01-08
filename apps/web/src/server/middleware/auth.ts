import { redirect } from '@tanstack/solid-router';
import { createMiddleware } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import { auth } from '../auth';

export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    const url = new URL(request.url);
    throw redirect({
      to: '/signin',
      search: { redirect: url.pathname + url.search },
    });
  }
  return await next();
});
