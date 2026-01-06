import { createFileRoute, redirect } from '@tanstack/solid-router';
import { useApi } from '../hooks/api';
import { fetchUser } from '../hooks/use-auth';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const userData = await fetchUser();
    if (userData) {
      // Check if user has any feeds
      const api = useApi();
      const { data, error } = await api.feeds.get();
      if (error) {
        const errVal = error.value as { summary?: string; message?: string } | undefined;
        throw new Error(errVal?.summary || errVal?.message || 'Request failed');
      }

      // If no feeds, redirect to feeds page to get started
      if (!data.length) {
        throw redirect({ to: '/feeds' });
      }

      // Otherwise, redirect to inbox as normal
      throw redirect({ to: '/inbox' });
    } else {
      throw redirect({ to: '/signin' });
    }
  },
});
