import { and, eq } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { Show, Suspense } from 'solid-js';
import { ArticleList } from '~/components/articles/ArticleList';
import { ArticleListToolbar } from '~/components/articles/ArticleListToolbar';
import {
  createArticleListState,
  type ArticleQueryFilter,
} from '~/components/articles/createArticleListState';
import { MarkAllArchivedButton } from '~/components/articles/MarkAllArchivedButton';
import { ReadStatusToggle } from '~/components/articles/ReadStatusToggle';
import { CenterLoader } from '~/components/Loader';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/tags/$tagId/articles')({
  validateSearch: validateReadStatusSearch,
  component: TagArticlesPage,
});

function TagArticlesPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const tagId = () => params()?.tagId;
  const readStatus = () => search()?.readStatus || 'unread';

  const filter: ArticleQueryFilter = {
    buildQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }: any) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }: any) => {
          const base = and(eq(articleTag.tagId, tagId()), eq(article.isArchived, false));
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        }),
    buildCountQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }: any) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }: any) => {
          const base = and(eq(articleTag.tagId, tagId()), eq(article.isArchived, false));
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ id: article.id })),
    buildUnreadQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }: any) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }: any) =>
          and(
            eq(articleTag.tagId, tagId()),
            eq(article.isArchived, false),
            eq(article.isRead, false),
          ),
        )
        .select(({ article }: any) => ({ id: article.id })),
    buildArchivableQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }: any) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }: any) =>
          and(eq(articleTag.tagId, tagId()), eq(article.isArchived, false)),
        )
        .select(({ article }: any) => ({ id: article.id })),
  };

  const state = createArticleListState({
    filter,
    readStatus: () => readStatus(),
    viewKey: `tag:${tagId()}`,
  });

  return (
    <>
      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        menuContent={
          <Show when={state.archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={state.archivableCount()}
                contextLabel="in this tag"
                onConfirm={state.markAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={state.unreadCount()}
        totalCount={state.totalCount()}
        readStatus={readStatus()}
      />

      <Suspense fallback={<CenterLoader />}>
        <Show
          when={state.feeds().length > 0 || state.tags().length > 0 || state.articles().length > 0}
        >
          <ArticleList
            articles={state.articles()}
            feeds={state.feeds()}
            tags={state.tags()}
            totalCount={state.totalCount()}
            onLoadMore={state.loadMore}
            onUpdateArticle={state.updateArticle}
            onAddTag={state.addTag}
            onRemoveTag={state.removeTag}
            readStatus={readStatus()}
            context="tag"
          />
        </Show>
      </Suspense>
    </>
  );
}
