import { and, eq, ilike, toArray, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { onMount } from 'solid-js';
import type { ReadStatus } from '~/components/ReadStatusToggle';
import { ShortsViewer } from '~/components/ShortsViewer';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { tagsCollection } from '~/entities/tags';
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
    const filter = readStatusFilter(readStatus(), sessionReadIds());
    return q
      .from({ article: articlesCollection })
      .where(({ article }) => {
        const base = and(
          eq(article.feedId, feedId()),
          eq(article.isArchived, false),
          ilike(article.url, '%youtube.com/shorts%'),
        );
        return filter ? and(base, filter(article)) : base;
      })
      .orderBy(({ article }) => article.pubDate, 'desc');
  });

  const feedWithTagsQuery = useLiveQuery((q) =>
    q
      .from({ feed: feedsCollection })
      .where(({ feed }) => eq(feed.id, feedId()))
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
  );

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
      shortsAccessor={shorts}
      feedsAccessor={() => feedWithTagsQuery() ?? []}
      backLink={{
        to: '/feeds/$feedId',
        text: 'Back to Feed',
        params: { feedId: feedId() },
      }}
      hasMore={false}
      loadMore={() => {}}
      isLoadingMore={false}
      onMarkAsRead={markAsRead}
      onToggleRead={toggleRead}
    />
  );
}
