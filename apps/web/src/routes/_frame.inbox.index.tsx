import type { MarkManyReadRequest } from '@repo/shared/types';
import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { articlesCollection, updateArticle } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import ShuffleIcon from 'lucide-solid/icons/shuffle';
import VideoIcon from 'lucide-solid/icons/video';
import { createSignal, Show, Suspense } from 'solid-js';
import { validateReadStatusSearch } from '../common/routing';
import { ArticleList } from '../components/ArticleList';
import { ArticleListToolbar } from '../components/ArticleListToolbar';
import { CommonErrorBoundary } from '../components/CommonErrorBoundary';
import { Header } from '../components/Header';
import { LazyModal, type ModalController } from '../components/LazyModal';
import { CenterLoader } from '../components/Loader';
import { MarkAllReadButton } from '../components/MarkAllReadButton';
import { ReadStatusToggle } from '../components/ReadStatusToggle';
import { useMarkManyRead } from '../hooks/queries';
import { useToast } from '../hooks/toast';

export const Route = createFileRoute('/_frame/inbox/')({
  validateSearch: validateReadStatusSearch,
  component: Inbox,
});

function Inbox() {
  const search = Route.useSearch();
  const readStatus = () => search().readStatus || 'unread';

  const isRead = () => (readStatus() === 'read' ? true : readStatus() === 'unread' ? false : null);

  const articlesQuery = useLiveQuery((q) => {
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
  const markManyReadMutation = useMarkManyRead();
  const { showToast } = useToast();

  let markAllModalController!: ModalController;
  const [isMarkingAllRead, setIsMarkingAllRead] = createSignal(false);

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingAllRead(true);
      const request: MarkManyReadRequest = {
        context: 'all',
      };
      await markManyReadMutation.mutateAsync(request);
      markAllModalController.close();
    } catch (err) {
      console.error('Mark many read failed:', err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const allArticles = () => {
    return articlesQuery.data || [];
  };

  const totalCount = () => {
    return articlesQuery.data?.length || 0;
  };

  const handleUpdateArticle = async (
    articleId: number,
    updates: { isRead?: boolean; isArchived?: boolean; tags?: number[] },
  ) => {
    // If archiving in the inbox view, show toast with undo
    if (updates.isArchived === true) {
      showToast('Article archived', {
        action: {
          label: 'Undo',
          onClick: async () => {
            await updateArticle(articleId, {
              isArchived: false,
            });
          },
        },
      });
    }

    await updateArticle(articleId, updates);
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
            <VideoIcon size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
        </div>
      </Header>

      <div class="container mx-auto p-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">Latest articles from all your RSS feeds</p>
        </div>
      </div>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <>
            <Show when={totalCount() > 0 && readStatus() === 'unread'}>
              <MarkAllReadButton context="all" totalCount={totalCount()} contextLabel="globally" />
            </Show>
          </>
        }
        mobileMenuContent={
          <>
            <Show when={totalCount() > 0 && readStatus() === 'unread'}>
              <li>
                <button onClick={() => markAllModalController.open()}>
                  Mark All Read ({totalCount()})
                </button>
              </li>
            </Show>
          </>
        }
        unreadCount={totalCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <div class="container mx-auto px-3 pb-3 sm:px-6 sm:pb-6">
        <CommonErrorBoundary>
          <Suspense fallback={<CenterLoader />}>
            <Show when={feedsQuery.data && tagsQuery.data}>
              <ArticleList
                articles={allArticles()}
                feeds={feedsQuery.data!}
                tags={tagsQuery.data!}
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
        title="Mark All as Read"
      >
        <div class="mb-6">
          <p class="mb-4">
            Are you sure you want to mark all unread articles as read globally? This action cannot
            be undone.
          </p>

          <Show when={totalCount() > 0}>
            <div class="bg-base-200 rounded-lg p-4">
              <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
              <p class="font-medium">
                {totalCount()} unread article{totalCount() !== 1 ? 's' : ''}
              </p>
            </div>
          </Show>
        </div>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onClick={() => markAllModalController.close()}
            disabled={isMarkingAllRead()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead()}
          >
            {isMarkingAllRead() && <span class="loading loading-spinner loading-sm"></span>}
            {isMarkingAllRead() ? 'Marking as Read...' : 'Mark All Read'}
          </button>
        </div>
      </LazyModal>
    </>
  );
}
