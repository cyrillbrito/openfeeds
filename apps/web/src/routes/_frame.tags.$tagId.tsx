import type { MarkManyReadRequest } from '@repo/shared/types';
import { eq, inArray } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link, useSearch } from '@tanstack/solid-router';
import { articlesCollection, updateArticle } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import ShuffleIcon from 'lucide-solid/icons/shuffle';
import { createSignal, Show, Suspense } from 'solid-js';
import { validateReadStatusSearch } from '../common/routing';
import { ArticleList } from '../components/ArticleList';
import { ArticleListToolbar } from '../components/ArticleListToolbar';
import { Header } from '../components/Header';
import { LazyModal, type ModalController } from '../components/LazyModal';
import { CenterLoader } from '../components/Loader';
import { MarkAllReadButton } from '../components/MarkAllReadButton';
import { ReadStatusToggle, type ReadStatus } from '../components/ReadStatusToggle';
import { ShuffleButton } from '../components/ShuffleButton';
import { useMarkManyRead } from '../hooks/queries';

export const Route = createFileRoute('/_frame/tags/$tagId')({
  validateSearch: validateReadStatusSearch,
  component: TagArticles,
});

function TagArticles() {
  const params = Route.useParams();
  const search = useSearch({ from: '/_frame/tags/$tagId' });
  const tagId = () => {
    const id = params().tagId;
    return id ? Number(id) : 0;
  };
  const readStatus = (): ReadStatus => search().readStatus || 'unread';
  const seed = () => search().seed;

  const isRead = () => (readStatus() === 'read' ? true : readStatus() === 'unread' ? false : null);

  const tagsQuery = useTags();
  const feedsQuery = useFeeds();
  const markManyReadMutation = useMarkManyRead();

  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => inArray(tagId(), article.tags));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  let markAllModalController!: ModalController;
  const [isMarkingAllRead, setIsMarkingAllRead] = createSignal(false);

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingAllRead(true);
      const request: MarkManyReadRequest = {
        context: 'tag',
        tagId: tagId(),
      };
      await markManyReadMutation.mutateAsync(request);
      markAllModalController.close();
    } catch (err) {
      console.error('Mark many read failed:', err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const tag = () => tagsQuery.data?.find((t) => t.id === tagId());

  const handleUpdateArticle = async (
    articleId: number,
    updates: { isRead?: boolean; tags?: number[] },
  ) => {
    await updateArticle(articleId, updates);
  };

  const articles = () => articlesQuery.data || [];

  const unreadCount = () => {
    return articles().filter((article) => !article.isRead).length;
  };

  return (
    <>
      <Header title={tag()?.name || `Tag #${tagId()}`} />

      <div class="container mx-auto p-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">Articles from feeds tagged with this label</p>
        </div>
      </div>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <>
            <ShuffleButton currentSeed={seed()} />
            <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
              <MarkAllReadButton
                context="tag"
                tagId={tagId()}
                totalCount={unreadCount()}
                contextLabel="in this tag"
              />
            </Show>
          </>
        }
        mobileMenuContent={
          <>
            <li>
              <Link
                to="."
                search={(prev: Record<string, any>) =>
                  prev.seed
                    ? { ...prev, seed: undefined }
                    : { ...prev, seed: Math.floor(Math.random() * 9999999999) + 1000000000 }
                }
              >
                <ShuffleIcon size={16} />
                {seed() ? 'Turn off shuffle' : 'Shuffle'}
              </Link>
            </li>
            <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
              <li>
                <button onClick={() => markAllModalController.open()}>
                  Mark All Read ({unreadCount()})
                </button>
              </li>
            </Show>
          </>
        }
        unreadCount={unreadCount()}
        totalCount={articles().length}
        readStatus={readStatus()}
      />

      <div class="container mx-auto px-3 pb-3 sm:px-6 sm:pb-6">
        <Suspense fallback={<CenterLoader />}>
          <Show
            when={feedsQuery.data && tagsQuery.data}
            fallback={
              <>
                {() => {
                  alert('when={feedsQuery.data && tagsQuery.data}');
                  return <>SHOW FALLBACK</>;
                }}
              </>
            }
          >
            <ArticleList
              articles={articles()}
              feeds={feedsQuery.data!}
              tags={tagsQuery.data!}
              onUpdateArticle={handleUpdateArticle}
              readStatus={readStatus()}
              context="tag"
            />
          </Show>
        </Suspense>
      </div>

      <LazyModal
        controller={(controller) => (markAllModalController = controller)}
        class="max-w-md"
        title="Mark All as Read"
      >
        <div class="mb-6">
          <p class="mb-4">
            Are you sure you want to mark all unread articles as read in this tag? This action
            cannot be undone.
          </p>

          <Show when={unreadCount() > 0}>
            <div class="bg-base-200 rounded-lg p-4">
              <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
              <p class="font-medium">
                {unreadCount()} unread article{unreadCount() !== 1 ? 's' : ''}
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
