import { and, eq, ilike, queryOnce } from '@tanstack/react-db';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Article } from '@repo/domain/client';
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
  const { tagId } = Route.useParams();
  const search = Route.useSearch();
  const readStatus: ReadStatus = search?.readStatus || 'unread';
  const feeds = useFeeds();

  const [snapshot, setSnapshot] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const filter = readStatusWhere(readStatus);
    queryOnce((q) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }) => {
          const base = and(
            eq(articleTag.tagId, tagId),
            eq(article.isArchived, false),
            ilike(article.url, '%youtube.com/shorts%'),
          );
          return filter ? and(base, filter(article)) : base;
        })
        .select(({ article }) => article)
        .orderBy(({ article }) => article.pubDate, 'desc'),
    )
      .then((result) => setSnapshot(result as Article[]))
      .finally(() => setLoading(false));
  }, [tagId, readStatus]);

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
      feeds={feeds}
      backLink={{
        to: '/tags/$tagId/articles',
        text: 'Back to Tag',
        params: { tagId },
      }}
      onSetRead={setRead}
    />
  );
}
