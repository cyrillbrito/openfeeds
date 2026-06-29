import { and, eq, ilike, queryOnce, toArray, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Article } from '@repo/domain/client';
import type { ReadStatus } from '~/components/articles/ReadStatusToggle';
import { CenterLoader } from '~/components/Loader';
import { ShortsViewer } from '~/components/ShortsViewer';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { tagsCollection } from '~/entities/tags';
import { readStatusWhere } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/feeds/$feedId/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: FeedShorts,
});

function FeedShorts() {
  const { feedId } = Route.useParams();
  const search = Route.useSearch();
  const readStatus: ReadStatus = search?.readStatus || 'unread';

  const [snapshot, setSnapshot] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const filter = readStatusWhere(readStatus);
    queryOnce((q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }) => {
          const base = and(
            eq(article.feedId, feedId),
            eq(article.isArchived, false),
            ilike(article.url, '%youtube.com/shorts%'),
          );
          return filter ? and(base, filter(article)) : base;
        })
        .orderBy(({ article }) => article.pubDate, 'desc'),
    )
      .then((result) => setSnapshot(result as Article[]))
      .finally(() => setLoading(false));
  }, [feedId, readStatus]);

  const { data: feedWithTagsData } = useLiveQuery(
    (q) =>
      q
        .from({ feed: feedsCollection })
        .where(({ feed }) => eq(feed.id, feedId))
        .select(({ feed }) => ({
          ...feed,
          tags: toArray(
            q
              .from({ ft: feedTagsCollection })
              .where(({ ft }) => eq(ft.feedId, feed.id))
              .join({ tag: tagsCollection }, ({ ft, tag }) => eq(ft.tagId, tag.id))
              .select(({ ft, tag }) => ({
                feedTagId: ft.id,
                id: tag.id,
                name: tag.name,
                color: tag.color,
              })),
          ),
        })),
    [feedId],
  );

  const setRead = (articleId: string, isRead: boolean) => {
    setSnapshot((prev) => prev?.map((a) => (a.id === articleId ? { ...a, isRead } : a)) ?? null);
    articlesCollection.update(articleId, (draft) => {
      draft.isRead = isRead;
    });
  };

  if (loading) return <CenterLoader />;

  return (
    <ShortsViewer
      readStatus={readStatus}
      shorts={snapshot ?? []}
      feeds={feedWithTagsData ?? []}
      backLink={{
        to: '/feeds/$feedId',
        text: 'Back to Feed',
        params: { feedId },
      }}
      onSetRead={setRead}
    />
  );
}
