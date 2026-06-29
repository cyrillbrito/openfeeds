import { eq, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute } from '@tanstack/react-router';
import { TagFeedsTab } from '~/components/TagFeedManager';
import { feedTagsCollection } from '~/entities/feed-tags';
import { useFeeds } from '~/entities/feeds';

export const Route = createFileRoute('/_frame/tags/$tagId/feeds')({
  component: TagFeedsPage,
});

function TagFeedsPage() {
  const { tagId } = Route.useParams();
  const feeds = useFeeds();
  const { data: tagFeedTags } = useLiveQuery(
    (q) => q.from({ feedTag: feedTagsCollection }).where(({ feedTag }) => eq(feedTag.tagId, tagId)),
    [tagId],
  );

  return <TagFeedsTab tagId={tagId} feeds={feeds} feedTags={tagFeedTags ?? []} />;
}
