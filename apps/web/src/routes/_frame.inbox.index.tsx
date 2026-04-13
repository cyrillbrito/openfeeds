import { and, eq } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { Show, Suspense } from 'solid-js';
import {
  ArticleList,
  ArticleListToolbar,
  createArticleListState,
  MarkAllArchivedButton,
  ReadStatusToggle,
  ShortsButton,
  SortToggle,
} from '~/components/articles';
import type { ArticleQueryFilter } from '~/components/articles';
import { CommonErrorBoundary } from '~/components/CommonErrorBoundary';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { articlesCollection } from '~/entities/articles';
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
  const { showToast } = useToast();

  const filter: ArticleQueryFilter = {
    buildQuery: (q, { readStatusWhere }) => {
      let query = q
        .from({ article: articlesCollection })
        .where(({ article }: any) => {
          const base = eq(article.isArchived, false);
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ ...article }));
      return query;
    },
    buildCountQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => {
          const base = eq(article.isArchived, false);
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ id: article.id })),
    buildUnreadQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => and(eq(article.isArchived, false), eq(article.isRead, false)))
        .select(({ article }: any) => ({ id: article.id })),
    buildArchivableQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => eq(article.isArchived, false))
        .select(({ article }: any) => ({ id: article.id })),
  };

  const state = createArticleListState({
    filter,
    readStatus: () => readStatus(),
    sortDirection: () => (sortOrder() === 'oldest' ? 'asc' : 'desc'),
    viewKey: 'inbox',
    onArchive: (articleId) => {
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
    },
  });

  return (
    <PageLayout
      title="Inbox"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <ShortsButton
            shortsExist={state.shortsExist()}
            linkProps={{ to: '/inbox/shorts', search: { readStatus: readStatus() } }}
          />
        </div>
      }
    >
      <p class="text-base-content-gray mb-4">Latest articles from all your feeds</p>

      <ArticleListToolbar
        leftContent={
          <>
            <ReadStatusToggle currentStatus={readStatus()} />
            <SortToggle currentSort={sortOrder()} />
          </>
        }
        menuContent={
          <Show when={state.archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={state.archivableCount()}
                contextLabel="globally"
                onConfirm={state.markAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={state.unreadCount()}
        totalCount={state.totalCount()}
        readStatus={readStatus()}
      />

      <CommonErrorBoundary>
        <Suspense fallback={<CenterLoader />}>
          <Show when={state.feeds().length > 0 || state.tags().length > 0 || state.articles().length > 0}>
            <ArticleList
              articles={state.articles()}
              feeds={state.feeds()}
              tags={state.tags()}
              articleTags={state.articleTags()}
              totalCount={state.totalCount()}
              onLoadMore={state.loadMore}
              onUpdateArticle={state.updateArticle}
              onAddTag={state.addTag}
              onRemoveTag={state.removeTag}
              readStatus={readStatus()}
              context="inbox"
            />
          </Show>
        </Suspense>
      </CommonErrorBoundary>
    </PageLayout>
  );
}
