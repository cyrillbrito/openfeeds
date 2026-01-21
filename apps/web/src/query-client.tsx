import { QueryClient } from '@tanstack/solid-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - required for persistence
      throwOnError: true,
      retry: 1,
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Persist query cache to IndexedDB (client-side only)
if (typeof window !== 'undefined') {
  const persister = {
    persistClient: async (client: unknown) => {
      await set('openfeeds-query-cache', client);
    },
    restoreClient: async () => {
      return await get('openfeeds-query-cache');
    },
    removeClient: async () => {
      await del('openfeeds-query-cache');
    },
  };

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  });
}
