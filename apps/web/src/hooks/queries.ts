import type {
  Article,
  ArticleTypeFilter,
  CreateFilterRuleApi,
  MarkManyArchivedRequest,
  PaginatedResponse,
  UpdateArticle,
  UpdateFilterRule,
} from '@repo/shared/types';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/solid-query';
import { createEffect, type Accessor } from 'solid-js';
import { produce } from 'solid-js/store';
import type { ReadStatus } from '../components/ReadStatusToggle';
import { useApi } from './api';

export const queryKeys = {
  feeds: () => ['feeds'] as const,
  feedFilterRules: (feedId: number) => ['feeds-filter-rules', feedId] as const,
  tags: () => ['tags'] as const,

  articles: (
    filters: {
      feedId?: number;
      tagId?: number;
      isRead?: boolean;
      isArchived?: boolean;
      type?: ArticleTypeFilter;
      seed?: string | number;
    } = {},
  ) => ['articles', filters] as const,

  article: (id: number) => ['articles', id] as const,
};

export function getFeedsQueryOptions() {
  const api = useApi();
  return {
    queryKey: queryKeys.feeds(),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error } = await api.feeds.get({ fetch: { signal } });
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
  };
}

export function useFeeds() {
  return useQuery(() => getFeedsQueryOptions());
}

export function useArticle(id: Accessor<number>) {
  const api = useApi();
  return useQuery(() => ({
    queryKey: queryKeys.article(id()),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error } = await api.articles({ id: id() }).get({ fetch: { signal } });
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
  }));
}

interface ArticlesOptions {
  readStatus: ReadStatus;
  feedId?: number;
  tagId?: number;
  type?: 'all' | 'shorts';
  seed?: number;
  isArchived?: boolean;
}

/**
 * Unified infinite query hook for all article scenarios.
 * Always uses infinite query with pagination support - components can choose to use only the first page if needed.
 * Disabled by default to avoid automatic refetch when articles are marked as read.
 * Options are passed as a single reactive accessor to ensure refetch when any parameter changes.
 */
export function useArticles(options: Accessor<ArticlesOptions>) {
  const api = useApi();

  const query = useInfiniteQuery(() => {
    const opts = options();
    const isRead =
      opts.readStatus === 'read' ? true : opts.readStatus === 'unread' ? false : undefined;

    return {
      queryKey: queryKeys.articles({
        feedId: opts.feedId,
        tagId: opts.tagId,
        isRead,
        isArchived: opts.isArchived,
        type: opts.type,
        seed: opts.seed,
      }),
      queryFn: async ({
        pageParam,
        signal,
      }: {
        pageParam: string | undefined;
        signal: AbortSignal;
      }) => {
        const { data, error } = await api.articles.get({
          query: {
            feedId: opts.feedId,
            tagId: opts.tagId,
            type: opts.type !== 'all' ? opts.type : undefined,
            isRead,
            isArchived: opts.isArchived,
            cursor: pageParam,
            limit: 20,
            seed: opts.seed,
          },
          fetch: { signal },
        });
        if (error) {
          throw new Error(error.value?.summary || error.value?.message || 'Request failed');
        }
        return data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: false,
    };
  });

  createEffect(() => {
    options(); // Track the entire options object
    void query.refetch();
  });

  return query;
}

// Feed Mutations
export function useCreateFeed() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async (input: { url: string }) => {
      const { data, error } = await api.feeds.post(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
    },
  }));
}

export function useDiscoverFeeds(url: Accessor<string>) {
  const api = useApi();

  return useQuery(() => ({
    queryKey: ['discover-feeds', url()],
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error } = await api.feeds.discover.post({ url: url() }, { fetch: { signal } });
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    enabled: Boolean(url()?.trim()),
  }));
}

export function useUpdateFeed() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: number;
      title?: string;
      description?: string | null;
      url?: string;
      tags?: number[];
    }) => {
      const { data, error } = await api.feeds({ id }).put(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
    },
  }));
}

export function useDeleteFeed() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async (id: number) => {
      const { data, error } = await api.feeds({ id }).delete();
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
    },
  }));
}

export function useSyncFeed() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async (feedId: number) => {
      const { data, error } = await api.feeds({ id: feedId }).sync.post();
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  }));
}

// Article Mutations
export function useUpdateArticle() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async ({ id, ...input }: { id: number } & UpdateArticle) => {
      const { data, error } = await api.articles({ id }).put(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onMutate: async ({ id, isRead, isArchived, tags }) => {
      try {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: ['articles'] });

        // Snapshot the previous value for rollback
        const previousData = queryClient.getQueriesData({ queryKey: ['articles'] });

        // Optimistically update all article related queries
        const queries = queryClient.getQueriesData({ queryKey: ['articles'] });

        queries.forEach(([queryKey, data]: [any, any]) => {
          if (!data) {
            return;
          }

          // Extract the filter parameters from the query key
          const filters = queryKey[1] as
            | {
                feedId?: number;
                tagId?: number;
                isRead?: boolean;
                isArchived?: boolean;
                type?: string;
                seed?: string | number;
              }
            | undefined;

          let updatedData = data;

          // Check if it's an array (legacy format, probably not used)
          if (Array.isArray(data)) {
            // If archiving and this is an inbox query (isArchived: false), remove the article
            if (isArchived === true && filters?.isArchived === false) {
              updatedData = data.filter((a) => a.id !== id);
            } else {
              updatedData = produce<Article[]>((articles) => {
                const article = articles.find((a) => a.id === id);
                if (article) {
                  if (isRead !== undefined) article.isRead = isRead ?? null;
                  if (isArchived !== undefined) article.isArchived = isArchived ?? null;
                  if (tags !== undefined) article.tags = tags;
                  return;
                }
              })(data);
            }
          }

          // Check if it's InfiniteData structure (article lists)
          if (data.pages && Array.isArray(data.pages)) {
            // If archiving and this is an inbox query (isArchived: false), remove the article
            if (isArchived === true && filters?.isArchived === false) {
              updatedData = produce<InfiniteData<PaginatedResponse<Article>>>((infData) => {
                for (const page of infData.pages) {
                  const articleIndex = page.data.findIndex((a) => a.id === id);
                  if (articleIndex !== -1) {
                    page.data.splice(articleIndex, 1);
                    if (page.total !== undefined) {
                      page.total -= 1;
                    }
                    return;
                  }
                }
              })(data);
            }
            // If un-archiving (isArchived: false) and article is not in this query,
            // skip the optimistic update and let onSettled handle the refetch
            else if (isArchived === false) {
              const articleExists = data.pages.some((page: PaginatedResponse<Article>) =>
                page.data.some((a: Article) => a.id === id),
              );
              if (!articleExists) {
                // Skip optimistic update, component will manually refetch
              } else {
                updatedData = produce<InfiniteData<PaginatedResponse<Article>>>((infData) => {
                  for (const page of infData.pages) {
                    const article = page.data.find((a) => a.id === id);
                    if (article) {
                      if (isRead !== undefined) article.isRead = isRead ?? null;
                      if (isArchived !== undefined) article.isArchived = isArchived ?? null;
                      if (tags !== undefined) article.tags = tags;
                      return;
                    }
                  }
                })(data);
              }
            } else {
              // Default case: update the article in place
              updatedData = produce<InfiniteData<PaginatedResponse<Article>>>((infData) => {
                for (const page of infData.pages) {
                  const article = page.data.find((a) => a.id === id);
                  if (article) {
                    if (isRead !== undefined) article.isRead = isRead ?? null;
                    if (isArchived !== undefined) article.isArchived = isArchived ?? null;
                    if (tags !== undefined) article.tags = tags;
                    return;
                  }
                }
              })(data);
            }
          }

          // Check if it's a single article (individual article query)
          if (data.id === id) {
            updatedData = produce<Article>((article) => {
              if (isRead !== undefined) article.isRead = isRead ?? null;
              if (isArchived !== undefined) article.isArchived = isArchived ?? null;
              if (tags !== undefined) article.tags = tags;
            })(data);
          }

          // Set the updated data back to the cache
          if (updatedData !== data) {
            queryClient.setQueryData(queryKey, updatedData);
          }
        });

        // Return context with previous data for rollback
        return { previousData };
      } catch (error) {
        console.error('Error in onMutate:', error);
        throw error;
      }
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous data on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Always invalidate after mutation completes to ensure consistency
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
      // Also invalidate the individual article query
      void queryClient.invalidateQueries({ queryKey: ['articles', id] });
    },
  }));
}

export function useMarkManyArchived() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async (input: MarkManyArchivedRequest) => {
      const { data, error } = await api.articles['mark-many-archived'].post(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  }));
}

// Filter Rule Queries
export function useFilterRules(feedId: number) {
  const api = useApi();
  return useQuery(() => ({
    queryKey: queryKeys.feedFilterRules(feedId),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error } = await api.feeds({ id: feedId }).rules.get({ fetch: { signal } });
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
  }));
}

// Filter Rule Mutations
export function useCreateFilterRule() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async ({ feedId, ...input }: { feedId: number } & CreateFilterRuleApi) => {
      const { data, error } = await api.feeds({ id: feedId }).rules.post(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: (_, { feedId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedFilterRules(feedId) });
    },
  }));
}

export function useUpdateFilterRule() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async ({
      feedId,
      ruleId,
      ...input
    }: { feedId: number; ruleId: number } & Partial<UpdateFilterRule>) => {
      const { data, error } = await api.feeds({ id: feedId }).rules({ ruleId }).put(input);
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: (_, { feedId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedFilterRules(feedId) });
    },
  }));
}

export function useDeleteFilterRule() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async ({ feedId, ruleId }: { feedId: number; ruleId: number }) => {
      const { data, error } = await api.feeds({ id: feedId }).rules({ ruleId }).delete();
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: (_, { feedId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedFilterRules(feedId) });
    },
  }));
}

export function useApplyFilterRules() {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation(() => ({
    mutationFn: async (feedId: number) => {
      const { data, error } = await api.feeds({ id: feedId }).rules.apply.post();
      if (error) {
        throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  }));
}
