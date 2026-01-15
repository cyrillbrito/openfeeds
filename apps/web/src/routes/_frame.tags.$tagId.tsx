import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link, useSearch } from '@tanstack/solid-router';
import ShuffleIcon from 'lucide-solid/icons/shuffle';
import { createSignal, onMount, Show, Suspense } from 'solid-js';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useSessionRead } from '~/hooks/session-read';
import { useTags } from '~/entities/tags';
import { validateReadStatusSearch } from '../common/routing';
import { ArticleList } from '../components/ArticleList';
import { ArticleListToolbar } from '../components/ArticleListToolbar';
import { Header } from '../components/Header';
import { LazyModal, type ModalController } from '../components/LazyModal';
import { CenterLoader } from '../components/Loader';
import { MarkAllArchivedButton } from '../components/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '../components/ReadStatusToggle';
import { ShuffleButton } from '../components/ShuffleButton';

export const Route = createFileRoute('/_frame/tags/$tagId')({
  validateSearch: validateReadStatusSearch,
  component: TagArticles,
});

function TagArticles() {
  const params = Route.useParams();
  const search = useSearch({ from: '/_frame/tags/$tagId' });
  const tagId = () => params().tagId;
  const readStatus = (): ReadStatus => search().readStatus || 'unread';
  const seed = () => search().seed;
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`tag:${tagId()}`));

  // Only filter by isRead on server when showing 'read' status
  const isRead = () => (readStatus() === 'read' ? true : null);

  const tagsQuery = useTags();
  const feedsQuery = useFeeds();

  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
        eq(article.id, articleTag.articleId),
      )
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()))
      .select(({ article }) => ({ ...article }));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

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

  const tag = () => tagsQuery.data?.find((t) => t.id === tagId());

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; tags?: string[] },
  ) => {
    // Track session-read articles
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }

    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.tags !== undefined) draft.tags = updates.tags;
    });
  };

  const articles = () => {
    const allArticles = articlesQuery.data || [];
    if (readStatus() !== 'unread') return allArticles;

    // Show unread + session-read articles
    return allArticles.filter((a) => !a.isRead || sessionReadIds().has(a.id));
  };

  const unreadCount = () => {
    return articles().filter((article) => !article.isRead).length;
  };

  return (
    <>
      <Header title={tag()?.name || `Tag #${tagId()}`} />

      <div class="container mx-auto px-2 py-3 sm:p-6">
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
              <MarkAllArchivedButton
                totalCount={unreadCount()}
                contextLabel="in this tag"
                onConfirm={handleMarkAllArchived}
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
                  Mark All Archived ({unreadCount()})
                </button>
              </li>
            </Show>
          </>
        }
        unreadCount={unreadCount()}
        totalCount={articles().length}
        readStatus={readStatus()}
      />

      <div class="container mx-auto px-2 pb-3 sm:px-6 sm:pb-6">
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
        title="Mark All as Archived"
      >
        <div class="mb-6">
          <p class="mb-4">
            Are you sure you want to mark all unarchived articles as archived in this tag? This
            action cannot be undone.
          </p>

          <Show when={unreadCount() > 0}>
            <div class="bg-base-200 rounded-lg p-4">
              <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
              <p class="font-medium">
                {unreadCount()} unarchived article{unreadCount() !== 1 ? 's' : ''}
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
