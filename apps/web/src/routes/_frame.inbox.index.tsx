import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { Video } from 'lucide-solid';
import { createSignal, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { CommonErrorBoundary } from '~/components/CommonErrorBoundary';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { PageLayout } from '~/components/PageLayout';
import { ReadStatusToggle } from '~/components/ReadStatusToggle';
import { SortToggle } from '~/components/SortToggle';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { useToast } from '~/providers/toast';
import { readStatusFilter } from '~/utils/article-queries';
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

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    const direction = sortOrder() === 'oldest' ? 'asc' : 'desc';
    return query.orderBy(({ article }) => article.pubDate, direction).limit(visibleCount());
  });

  // Lightweight count query - only selects id to avoid tracking full article objects
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.select(({ article }) => ({ id: article.id }));
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
      const articleIds = (totalCountQuery() || []).map((a) => a.id);
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

  // Articles are already filtered by the live query (including session-read handling)
  const filteredArticles = () => articlesQuery() || [];

  const totalCount = () => (totalCountQuery() || []).length;

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
          <Link
            to="/inbox/shorts"
            search={{ readStatus: readStatus() }}
            class="btn btn-accent btn-sm"
          >
            <Video size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
        </div>
      }
    >
      <p class="text-base-content-gray mb-4">Latest articles from all your RSS feeds</p>

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

      <CommonErrorBoundary>
        <Suspense fallback={<CenterLoader />}>
          <Show when={feedsQuery() && tagsQuery()}>
            <ArticleList
              articles={filteredArticles()}
              feeds={feedsQuery()!}
              tags={tagsQuery()!}
              totalCount={totalCount()}
              onLoadMore={handleLoadMore}
              onUpdateArticle={handleUpdateArticle}
              readStatus={readStatus()}
              context="inbox"
            />
          </Show>
        </Suspense>
      </CommonErrorBoundary>

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
    </PageLayout>
  );
}
