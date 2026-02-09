import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { Video } from 'lucide-solid';
import { createMemo, createSignal, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { CommonErrorBoundary } from '~/components/CommonErrorBoundary';
import { Header } from '~/components/Header';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { ReadStatusToggle } from '~/components/ReadStatusToggle';
import { SortToggle } from '~/components/SortToggle';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { useToast } from '~/providers/toast';
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

  // Pagination state - lifted from ArticleList
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Only filter by isRead on server when showing 'read' status
  // For 'unread', we handle filtering client-side to support session-read tracking
  const isRead = () => (readStatus() === 'read' ? true : null);

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    const direction = sortOrder() === 'oldest' ? 'asc' : 'desc';
    return query.orderBy(({ article }) => article.pubDate, direction).limit(visibleCount());
  });

  // Query for total count (without limit) - needed for pagination UI and "mark all archived"
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  const feedsQuery = useFeeds();
  const tagsQuery = useTags();
  const { showToast } = useToast();

  let markAllModalController!: ModalController;
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
      // Use totalCountQuery to get ALL article IDs (not just visible)
      const articleIds = (totalCountQuery.data || []).map((a) => a.id);
      if (articleIds.length > 0) {
        articlesCollection.update(articleIds, (drafts) => {
          drafts.forEach((d) => (d.isArchived = true));
        });
      }
      markAllModalController.close();
    } catch (err) {
      console.error('Mark many archived failed:', err);
    } finally {
      setIsMarkingAllArchived(false);
    }
  };

  // Filter for session-read articles (client-side)
  const filteredArticles = createMemo(() => {
    const articles = articlesQuery.data || [];
    if (readStatus() !== 'unread') return articles;

    return articles.filter((a) => !a.isRead || sessionReadIds().has(a.id));
  });

  const totalCount = () => {
    const allArticles = totalCountQuery.data || [];
    if (readStatus() !== 'unread') return allArticles.length;

    // For unread, apply same filter to get accurate count
    return allArticles.filter((a) => !a.isRead || sessionReadIds().has(a.id)).length;
  };

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
    <>
      <Header title="Inbox">
        <div class="flex flex-wrap gap-2">
          <Link
            to="/inbox/shorts"
            search={{ readStatus: readStatus() }}
            class="btn btn-accent btn-sm"
          >
            <Video size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
        </div>
      </Header>

      <div class="mx-auto w-full max-w-2xl px-2 py-3 sm:p-6 xl:max-w-3xl">
        <p class="text-base-content-gray">Latest articles from all your RSS feeds</p>
      </div>

      <ArticleListToolbar
        leftContent={
          <>
            <ReadStatusToggle currentStatus={readStatus()} />
            <SortToggle currentSort={sortOrder()} />
          </>
        }
        rightContent={
          <>
            <Show when={totalCount() > 0 && readStatus() === 'unread'}>
              <MarkAllArchivedButton
                totalCount={totalCount()}
                contextLabel="globally"
                onConfirm={handleMarkAllArchived}
              />
            </Show>
          </>
        }
        mobileMenuContent={
          <>
            <Show when={totalCount() > 0 && readStatus() === 'unread'}>
              <li>
                <button onClick={() => markAllModalController.open()}>
                  Mark All Archived ({totalCount()})
                </button>
              </li>
            </Show>
          </>
        }
        unreadCount={totalCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <div class="mx-auto w-full max-w-2xl px-2 pb-3 sm:px-6 sm:pb-6 xl:max-w-3xl">
        <CommonErrorBoundary>
          <Suspense fallback={<CenterLoader />}>
            <Show when={feedsQuery.data && tagsQuery.data}>
              <ArticleList
                articles={filteredArticles()}
                feeds={feedsQuery.data!}
                tags={tagsQuery.data!}
                totalCount={totalCount()}
                onLoadMore={handleLoadMore}
                onUpdateArticle={handleUpdateArticle}
                readStatus={readStatus()}
                context="inbox"
              />
            </Show>
          </Suspense>
        </CommonErrorBoundary>
      </div>

      <LazyModal
        controller={(controller) => (markAllModalController = controller)}
        class="max-w-md"
        title="Mark All as Archived"
      >
        <div class="mb-6">
          <p class="mb-4">
            Are you sure you want to mark all unarchived articles as archived globally? This action
            cannot be undone.
          </p>

          <Show when={totalCount() > 0}>
            <div class="bg-base-200 rounded-lg p-4">
              <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
              <p class="font-medium">
                {totalCount()} unarchived article{totalCount() !== 1 ? 's' : ''}
              </p>
            </div>
          </Show>
        </div>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onClick={() => markAllModalController.close()}
            disabled={isMarkingAllArchived()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={handleMarkAllArchived}
            disabled={isMarkingAllArchived()}
          >
            {isMarkingAllArchived() && <span class="loading loading-spinner loading-sm"></span>}
            {isMarkingAllArchived() ? 'Archiving...' : 'Mark All Archived'}
          </button>
        </div>
      </LazyModal>
    </>
  );
}
