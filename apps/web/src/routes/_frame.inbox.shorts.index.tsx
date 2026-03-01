import { eq, ilike, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { onMount } from 'solid-js';
import type { ReadStatus } from '~/components/ReadStatusToggle';
import { ShortsViewer } from '~/components/ShortsViewer';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';

export const Route = createFileRoute('/_frame/inbox/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: InboxShorts,
});

function InboxShorts() {
  const search = Route.useSearch();
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey('inbox-shorts'));

  const shortsQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false))
      .where(({ article }) => ilike(article.url, '%youtube.com/shorts%'));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc');
  });

  const feedsQuery = useFeeds();

  const allShorts = () => shortsQuery() || [];

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
      shortsAccessor={allShorts}
      feedsAccessor={() => feedsQuery() || []}
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
