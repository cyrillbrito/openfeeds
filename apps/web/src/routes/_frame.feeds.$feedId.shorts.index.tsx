import { eq, ilike } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, useSearch } from '@tanstack/solid-router';
import { articlesCollection, updateArticle } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { validateReadStatusSearch } from '../common/routing';
import { type ReadStatus } from '../components/ReadStatusToggle';
import { ShortsViewer } from '../components/ShortsViewer';

export const Route = createFileRoute('/_frame/feeds/$feedId/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: FocusedShorts,
});

function FocusedShorts() {
  const params = Route.useParams();
  const search = useSearch({ from: '/_frame/feeds/$feedId/shorts/' });
  const feedId = () => {
    const id = params().feedId;
    return id ? Number(id) : 0;
  };
  const readStatus = (): ReadStatus => search().readStatus || 'unread';

  const isRead = () => (readStatus() === 'read' ? true : readStatus() === 'unread' ? false : null);

  const shortsQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()))
      .where(({ article }) => ilike(article.url, '%youtube.com/shorts%'));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  const feedsQuery = useFeeds();

  const shorts = () => shortsQuery.data || [];

  const markAsRead = async (articleId: number) => {
    await updateArticle(articleId, { isRead: true });
  };

  const toggleRead = async (articleId: number, isRead: boolean) => {
    await updateArticle(articleId, { isRead });
  };

  return (
    <ShortsViewer
      readStatus={readStatus()}
      seed={undefined}
      shortsAccessor={shorts}
      feedsAccessor={() => feedsQuery.data || []}
      backLink={{
        to: '/feeds/$feedId',
        text: 'Back to Feed',
        params: { feedId: feedId().toString() },
      }}
      hasMore={false}
      loadMore={() => {}}
      isLoadingMore={false}
      onMarkAsRead={markAsRead}
      onToggleRead={toggleRead}
    />
  );
}
