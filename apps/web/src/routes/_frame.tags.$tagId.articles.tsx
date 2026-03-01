import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '~/components/ReadStatusToggle';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/tags/$tagId/articles')({
  validateSearch: validateReadStatusSearch,
  component: TagArticlesPage,
});

function TagArticlesPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const tagId = () => params()?.tagId;
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`tag:${tagId()}`));

  // Pagination state
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  const tagsQuery = useTags();
  const feedsQuery = useFeeds();

  // Query articles with join, orderBy, and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
        eq(article.id, articleTag.articleId),
      )
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()))
      .select(({ article }) => ({ ...article }));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc').limit(visibleCount());
  });

  // Lightweight count query - only selects id to avoid tracking full article objects
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
        eq(article.id, articleTag.articleId),
      )
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.select(({ article }) => ({ id: article.id }));
  });

  let markAllModalController!: ModalController;
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
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

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean },
  ) => {
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }

    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
    });
  };

  const filteredArticles = () => articlesQuery() || [];
  const totalCount = () => (totalCountQuery() || []).length;
  const unreadCount = () => filteredArticles().filter((article) => !article.isRead).length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  return (
    <>
      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
            <MarkAllArchivedButton
              totalCount={unreadCount()}
              contextLabel="in this tag"
              onConfirm={handleMarkAllArchived}
            />
          </Show>
        }
        mobileMenuContent={
          <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
            <li>
              <button onClick={() => markAllModalController.open()}>
                Mark All Archived ({unreadCount()})
              </button>
            </li>
          </Show>
        }
        unreadCount={unreadCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

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
            context="tag"
          />
        </Show>
      </Suspense>

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
