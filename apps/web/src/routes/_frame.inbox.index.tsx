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
import { ReadStatusToggle } from '~/components/articles/ReadStatusToggle';
import type { ReadStatus } from '~/components/articles/ReadStatusToggle';
import { ShortsButton } from '~/components/articles/ShortsButton';
import { SortToggle } from '~/components/articles/SortToggle';
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
    buildQuery: (q, { readStatusWhere }) =>
      q.from({ article: articlesCollection }).where(({ article }: any) => {
        const base = eq(article.isArchived, false);
        return readStatusWhere ? and(base, readStatusWhere(article)) : base;
      }),
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

  return (
    <ArticleListProvider
      filter={filter}
      readStatus={() => readStatus()}
      sortDirection={() => (sortOrder() === 'oldest' ? 'asc' : 'desc')}
      viewKey="inbox"
      context="inbox"
      onArchive={(articleId) => {
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
      }}
    >
      <InboxContent readStatus={readStatus()} sortOrder={sortOrder()} />
    </ArticleListProvider>
  );
}

function InboxContent(props: { readStatus: ReadStatus; sortOrder: string }) {
  const ctx = useArticleList();

  return (
    <PageLayout
      title="Inbox"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <ShortsButton
            shortsExist={ctx.shortsExist()}
            linkProps={{ to: '/inbox/shorts', search: { readStatus: props.readStatus } }}
          />
        </div>
      }
    >
      <p class="text-base-content-gray mb-4">Latest articles from all your feeds</p>

      <ArticleListToolbar
        leftContent={
          <>
            <ReadStatusToggle currentStatus={props.readStatus} />
            <SortToggle currentSort={props.sortOrder as any} />
          </>
        }
        menuContent={
          <Show when={ctx.archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={ctx.archivableCount()}
                contextLabel="globally"
                onConfirm={ctx.markAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={ctx.unreadCount()}
        totalCount={ctx.totalCount()}
        readStatus={props.readStatus}
      />

      <CommonErrorBoundary>
        <Suspense fallback={<CenterLoader />}>
          <Show when={ctx.feeds().length > 0 || ctx.tags().length > 0 || ctx.articles().length > 0}>
            <ArticleList />
          </Show>
        </Suspense>
      </CommonErrorBoundary>
    </PageLayout>
  );
}
