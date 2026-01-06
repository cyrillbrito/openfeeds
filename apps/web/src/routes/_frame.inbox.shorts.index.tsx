import { eq, ilike } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, useSearch } from '@tanstack/solid-router';
import { articlesCollection, updateArticle } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { validateReadStatusSearch } from '../common/routing';
import { type ReadStatus } from '../components/ReadStatusToggle';
import { ShortsViewer } from '../components/ShortsViewer';

export const Route = createFileRoute('/_frame/inbox/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: InboxShorts,
});

function InboxShorts() {
  const search = useSearch({ from: '/_frame/inbox/shorts/' });
  const readStatus = (): ReadStatus => search().readStatus || 'unread';

  const isRead = () => (readStatus() === 'read' ? true : readStatus() === 'unread' ? false : null);

  const shortsQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false))
      .where(({ article }) => ilike(article.url, '%youtube.com/shorts%'));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  const feedsQuery = useFeeds();

  const allShorts = () => {
    return shortsQuery.data || [];
  };

  const markAsRead = (articleId: number) => {
    updateArticle(articleId, { isRead: true });
  };

  const toggleRead = (articleId: number, isRead: boolean) => {
    updateArticle(articleId, { isRead });
  };

  return (
    <ShortsViewer
      readStatus={readStatus()}
      seed={undefined}
      shortsAccessor={allShorts}
      feedsAccessor={() => feedsQuery.data || []}
      backLink={{
        to: '/inbox',
        text: 'Back to Inbox',
      }}
      hasMore={false}
      loadMore={() => {}}
      isLoadingMore={false}
      onMarkAsRead={markAsRead}
      onToggleRead={toggleRead}
    />
  );
}
