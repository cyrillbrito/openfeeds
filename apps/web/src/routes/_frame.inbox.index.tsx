import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/hooks/session-read';
import VideoIcon from 'lucide-solid/icons/video';
import { createSignal, onMount, Show, Suspense } from 'solid-js';
import { validateReadStatusSearch } from '../common/routing';
import { ArticleList } from '../components/ArticleList';
import { ArticleListToolbar } from '../components/ArticleListToolbar';
import { CommonErrorBoundary } from '../components/CommonErrorBoundary';
import { Header } from '../components/Header';
import { LazyModal, type ModalController } from '../components/LazyModal';
import { CenterLoader } from '../components/Loader';
import { MarkAllArchivedButton } from '../components/MarkAllArchivedButton';
import { ReadStatusToggle } from '../components/ReadStatusToggle';
import { useToast } from '../hooks/toast';

export const Route = createFileRoute('/_frame/inbox/')({
  validateSearch: validateReadStatusSearch,
  component: Inbox,
});

function Inbox() {
  const search = Route.useSearch();
  const readStatus = () => search().readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey('inbox'));

  // Only filter by isRead on server when showing 'read' status
  // For 'unread', we handle filtering client-side to support session-read tracking
  const isRead = () => (readStatus() === 'read' ? true : null);

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
  const { showToast } = useToast();

  let markAllModalController!: ModalController;
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
      const articleIds = (articlesQuery.data || []).map((a) => a.id);
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

  const allArticles = () => {
    const articles = articlesQuery.data || [];
    if (readStatus() !== 'unread') return articles;

    // Show unread + session-read articles
    return articles.filter((a) => !a.isRead || sessionReadIds().has(a.id));
  };

  const totalCount = () => {
    return articlesQuery.data?.length || 0;
  };

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean; tags?: string[] },
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
      if (updates.tags !== undefined) draft.tags = updates.tags;
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
            <VideoIcon size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
        </div>
      </Header>

      <div class="container mx-auto px-2 py-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">Latest articles from all your RSS feeds</p>
        </div>
      </div>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
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

      <div class="container mx-auto px-2 pb-3 sm:px-6 sm:pb-6">
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
