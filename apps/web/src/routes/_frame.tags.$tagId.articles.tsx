import { and, eq } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { Show, Suspense } from 'solid-js';
import { ArticleList } from '~/components/articles/ArticleList';
import {
  ArticleListProvider,
  useArticleList,
  type ArticleQueryFilter,
} from '~/components/articles/ArticleListContext';
import { ArticleListToolbar } from '~/components/articles/ArticleListToolbar';
import { MarkAllArchivedButton } from '~/components/articles/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '~/components/articles/ReadStatusToggle';
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
          const base = eq(articleTag.tagId, tagId());
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => article),
    buildCountQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }: any) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }: any) => {
          const base = eq(articleTag.tagId, tagId());
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
          and(eq(articleTag.tagId, tagId()), eq(article.isRead, false)),
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

  return (
    <ArticleListProvider
      filter={filter}
      readStatus={() => readStatus()}
      viewKey={`tag:${tagId()}`}
      context="tag"
    >
      <TagArticlesContent readStatus={readStatus()} />
    </ArticleListProvider>
  );
}

function TagArticlesContent(props: { readStatus: ReadStatus }) {
  const ctx = useArticleList();

  return (
    <>
      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={props.readStatus} />}
        menuContent={
          <Show when={ctx.archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={ctx.archivableCount()}
                contextLabel="in this tag"
                onConfirm={ctx.markAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={ctx.unreadCount()}
        totalCount={ctx.totalCount()}
        readStatus={props.readStatus as any}
      />

      <Suspense fallback={<CenterLoader />}>
        <Show when={ctx.feeds().length > 0 || ctx.tags().length > 0 || ctx.articles().length > 0}>
          <ArticleList />
        </Show>
      </Suspense>
    </>
  );
}
