import { and, eq, ilike, queryOnce } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { createResource, Show } from 'solid-js';
import type { ReadStatus } from '~/components/articles/ReadStatusToggle';
import { CenterLoader } from '~/components/Loader';
import { ShortsViewer } from '~/components/ShortsViewer';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { readStatusWhere } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/tags/$tagId/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: TagShorts,
});

function TagShorts() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const tagId = () => params()?.tagId;
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const feedsQuery = useFeeds();

  // One-shot snapshot — refetches when tagId or readStatus changes.
  const [snapshot, { mutate: mutateSnapshot }] = createResource(
    () => ({ id: tagId(), status: readStatus() }),
    async ({ id, status }) => {
      const filter = readStatusWhere(status);
      return queryOnce((q) =>
        q
          .from({ article: articlesCollection })
          .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
            eq(article.id, articleTag.articleId),
          )
          .where(({ article, articleTag }) => {
            const base = and(
              eq(articleTag.tagId, id),
              eq(article.isArchived, false),
              ilike(article.url, '%youtube.com/shorts%'),
            );
            return filter ? and(base, filter(article)) : base;
          })
          .select(({ article }) => article)
          .orderBy(({ article }) => article.pubDate, 'desc'),
      );
    },
  );

  const setRead = (articleId: string, isRead: boolean) => {
    mutateSnapshot((prev) => prev?.map((a) => (a.id === articleId ? { ...a, isRead } : a)));
    articlesCollection.update(articleId, (draft) => {
      draft.isRead = isRead;
    });
  };

  return (
    <Show when={snapshot.state !== 'pending'} fallback={<CenterLoader />}>
      <ShortsViewer
        readStatus={readStatus()}
        shorts={snapshot() ?? []}
        feeds={feedsQuery() ?? []}
        backLink={{
          to: '/tags/$tagId',
          text: 'Back to Tag',
          params: { tagId: tagId() },
        }}
        onSetRead={setRead}
      />
    </Show>
  );
}
