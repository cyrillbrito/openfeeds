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

export const Route = createFileRoute('/_frame/feeds/$feedId/shorts/')({
  validateSearch: validateReadStatusSearch,
  component: FocusedShorts,
});

function FocusedShorts() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const feedId = () => params()?.feedId;
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`feed-shorts:${feedId()}`));

  const shortsQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()))
      .where(({ article }) => ilike(article.url, '%youtube.com/shorts%'));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc');
  });

  const feedsQuery = useFeeds();

  const shorts = () => shortsQuery() || [];

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
      feedsAccessor={() => feedsQuery() || []}
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
