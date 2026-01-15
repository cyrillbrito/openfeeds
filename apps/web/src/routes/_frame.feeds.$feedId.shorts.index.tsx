import { eq, ilike } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, useSearch } from '@tanstack/solid-router';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useSessionRead } from '~/hooks/session-read';
import { onMount } from 'solid-js';
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
  const feedId = () => params().feedId;
  const readStatus = (): ReadStatus => search().readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`feed-shorts:${feedId()}`));

  // Only filter by isRead on server when showing 'read' status
  const isRead = () => (readStatus() === 'read' ? true : null);

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

  const shorts = () => {
    const allShorts = shortsQuery.data || [];
    if (readStatus() !== 'unread') return allShorts;

    // Show unread + session-read shorts
    return allShorts.filter((a) => !a.isRead || sessionReadIds().has(a.id));
  };

  const markAsRead = (articleId: string) => {
    addSessionRead(articleId);
    articlesCollection.update(articleId, (draft) => {
      draft.isRead = true;
    });
  };

  const toggleRead = (articleId: string, isRead: boolean) => {
    if (isRead) {
      addSessionRead(articleId);
    }
    articlesCollection.update(articleId, (draft) => {
      draft.isRead = isRead;
    });
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
