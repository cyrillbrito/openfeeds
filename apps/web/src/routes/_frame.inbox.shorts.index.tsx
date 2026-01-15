import { eq, ilike } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, useSearch } from '@tanstack/solid-router';
import { onMount } from 'solid-js';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useSessionRead } from '~/hooks/session-read';
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
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey('inbox-shorts'));

  // Only filter by isRead on server when showing 'read' status
  const isRead = () => (readStatus() === 'read' ? true : null);

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
    const shorts = shortsQuery.data || [];
    if (readStatus() !== 'unread') return shorts;

    // Show unread + session-read shorts
    return shorts.filter((a) => !a.isRead || sessionReadIds().has(a.id));
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
