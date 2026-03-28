import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
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

  // Lightweight count query for current read status filter (no limit)
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

  // Count of unread articles (independent of current read status filter)
  const unreadCountQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
        eq(article.id, articleTag.articleId),
      )
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()))
      .where(({ article }) => eq(article.isArchived, false))
      .where(({ article }) => eq(article.isRead, false))
      .select(({ article }) => ({ id: article.id })),
  );

  // Non-archived articles for this tag (for archive button count + action)
  const archivableQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
        eq(article.id, articleTag.articleId),
      )
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()))
      .where(({ article }) => eq(article.isArchived, false))
      .select(({ article }) => ({ id: article.id })),
  );

  const handleMarkAllArchived = async () => {
    const articleIds = (archivableQuery() || []).map((a) => a.id);
    if (articleIds.length > 0) {
      articlesCollection.update(articleIds, (drafts) => {
        drafts.forEach((d) => (d.isArchived = true));
      });
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
  const unreadCount = () => (unreadCountQuery() || []).length;
  const archivableCount = () => (archivableQuery() || []).length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  return (
    <>
      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <Show when={archivableCount() > 0}>
            <MarkAllArchivedButton
              totalCount={archivableCount()}
              contextLabel="in this tag"
              onConfirm={handleMarkAllArchived}
            />
          </Show>
        }
        mobileMenuContent={
          <Show when={archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={archivableCount()}
                contextLabel="in this tag"
                onConfirm={handleMarkAllArchived}
              />
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
            feeds={feedsQuery()}
            tags={tagsQuery()}
            totalCount={totalCount()}
            onLoadMore={handleLoadMore}
            onUpdateArticle={handleUpdateArticle}
            readStatus={readStatus()}
            context="tag"
          />
        </Show>
      </Suspense>
    </>
  );
}
