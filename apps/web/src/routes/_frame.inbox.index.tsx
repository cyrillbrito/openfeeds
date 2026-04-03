import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { createEffect, createSignal, on, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { CommonErrorBoundary } from '~/components/CommonErrorBoundary';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { PageLayout } from '~/components/PageLayout';
import { ReadStatusToggle } from '~/components/ReadStatusToggle';
import { ShortsButton } from '~/components/ShortsButton';
import { SortToggle } from '~/components/SortToggle';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { useToast } from '~/providers/toast';
import { readStatusFilter } from '~/utils/article-queries';
import { getListVisibleCount, setListVisibleCount } from '~/utils/list-view-state';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/inbox/')({
  validateSearch: validateReadStatusSearch,
  component: Inbox,
});

function Inbox() {
  const search = Route.useSearch();
  const readStatus = () => search()?.readStatus || 'unread';
  const sortOrder = () => search()?.sort || 'newest';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey('inbox'));

  const listStateKey = () => `inbox:${readStatus()}:${sortOrder()}`;

  // Pagination state - persisted per list view key
  const [visibleCount, setVisibleCount] = createSignal(
    getListVisibleCount(listStateKey(), ARTICLES_PER_PAGE),
  );

  // Restore visible count when list context changes (read status/sort)
  createEffect(
    on(listStateKey, (key) => {
      setVisibleCount(getListVisibleCount(key, ARTICLES_PER_PAGE));
    }),
  );

  // Keep visible count persisted while user scrolls/loads more
  createEffect(() => {
    setListVisibleCount(listStateKey(), visibleCount());
  });

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article as any));
    }

    const direction = sortOrder() === 'oldest' ? 'asc' : 'desc';
    return query.orderBy(({ article }) => article.pubDate, direction).limit(visibleCount());
  });

  // Lightweight count query for current read status filter (no limit)
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article as any));
    }

    return query.select(({ article }) => ({ id: article.id }));
  });

  // Count of unread articles (independent of current read status filter)
  const unreadCountQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false))
      .where(({ article }) => eq(article.isRead, false))
      .select(({ article }) => ({ id: article.id })),
  );

  // Non-archived articles (for archive button count + action) — independent of read status filter
  const archivableQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false))
      .select(({ article }) => ({ id: article.id })),
  );

  const feedsQuery = useFeeds();
  const tagsQuery = useTags();
  const { showToast } = useToast();

  const handleMarkAllArchived = async () => {
    const articleIds = (archivableQuery() || []).map((a) => a.id);
    if (articleIds.length > 0) {
      articlesCollection.update(articleIds, (drafts) => {
        drafts.forEach((d) => (d.isArchived = true));
      });
    }
  };

  // Articles are already filtered by the live query (including session-read handling)
  const filteredArticles = () => articlesQuery() || [];
  const totalCount = () => (totalCountQuery() || []).length;
  const unreadCount = () => (unreadCountQuery() || []).length;
  const archivableCount = () => (archivableQuery() || []).length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean },
  ) => {
    // Track session-read articles
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }

    // If archiving in the inbox view, show toast with undo
    if (updates.isArchived === true) {
      showToast('Article archived', {
        action: {
          label: 'Undo',
          onClick: () => {
            articlesCollection.update(articleId, (draft) => {
              draft.isArchived = false;
            });
          },
        },
      });
    }

    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
    });
  };

  return (
    <PageLayout
      title="Inbox"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <ShortsButton
            where={(article) => eq(article.isArchived, false)}
            linkProps={{ to: '/inbox/shorts', search: { readStatus: readStatus() } }}
          />
        </div>
      }
    >
      <p class="text-base-content-gray mb-4">Latest articles from all your feeds</p>

      <ArticleListToolbar
        leftContent={
          <>
            <ReadStatusToggle currentStatus={readStatus()} />
            <SortToggle currentSort={sortOrder()} />
          </>
        }
        rightContent={
          <Show when={archivableCount() > 0}>
            <MarkAllArchivedButton
              totalCount={archivableCount()}
              contextLabel="globally"
              onConfirm={handleMarkAllArchived}
            />
          </Show>
        }
        mobileMenuContent={
          <Show when={archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={archivableCount()}
                contextLabel="globally"
                onConfirm={handleMarkAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={unreadCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <CommonErrorBoundary>
        <Suspense fallback={<CenterLoader />}>
          <Show when={feedsQuery() && tagsQuery()}>
            <ArticleList
              articles={filteredArticles() as any}
              feeds={feedsQuery()}
              tags={tagsQuery()}
              totalCount={totalCount()}
              onLoadMore={handleLoadMore}
              onUpdateArticle={handleUpdateArticle}
              readStatus={readStatus()}
              context="inbox"
            />
          </Show>
        </Suspense>
      </CommonErrorBoundary>
    </PageLayout>
  );
}
