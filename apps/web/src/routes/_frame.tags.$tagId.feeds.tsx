import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import { Show } from 'solid-js';
import { TagFeedsTab } from '~/components/TagFeedManager';
import { feedTagsCollection } from '~/entities/feed-tags';
import { useFeeds } from '~/entities/feeds';

export const Route = createFileRoute('/_frame/tags/$tagId/feeds')({
  component: TagFeedsPage,
});

function TagFeedsPage() {
  const params = Route.useParams();
  const tagId = () => params()?.tagId;

  const feedsQuery = useFeeds();

  const tagFeedTagsQuery = useLiveQuery((q) =>
    q.from({ feedTag: feedTagsCollection }).where(({ feedTag }) => eq(feedTag.tagId, tagId())),
  );

  return (
    <Show when={feedsQuery()}>
      <TagFeedsTab tagId={tagId()} feeds={feedsQuery()!} feedTags={tagFeedTagsQuery() ?? []} />
    </Show>
  );
}
