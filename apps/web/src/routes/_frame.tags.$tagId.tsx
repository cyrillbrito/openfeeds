import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/solid-router';
import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createEffect, createMemo, on, Show, Suspense } from 'solid-js';
import { ColorIndicator } from '~/components/ColorIndicator';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { TagEmptyState } from '~/components/TagFeedManager';
import { articleTagsCollection } from '~/entities/article-tags';
import { feedTagsCollection } from '~/entities/feed-tags';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/tags/$tagId')({
  component: TagLayout,
});

const TABS = [
  { label: 'Articles', to: '/tags/$tagId/articles' as const },
  { label: 'Feeds', to: '/tags/$tagId/feeds' as const },
] as const;

function TagLayout() {
  const params = Route.useParams();
  const tagId = () => params()?.tagId;
  const location = useLocation();

  const isOnIndex = () => {
    const path = location().pathname;
    return path === `/tags/${tagId()}` || path === `/tags/${tagId()}/`;
  };

  const tagsQuery = useTags();
  const feedsQuery = useFeeds();
  const tag = createMemo(() => tagsQuery()?.find((t) => t.id === tagId()));

  const taggedFeedsQuery = useLiveQuery((q) =>
    q
      .from({ feedTag: feedTagsCollection })
      .where(({ feedTag }) => eq(feedTag.tagId, tagId()))
      .select(({ feedTag }) => ({ id: feedTag.id }))
      .limit(1),
  );

  const taggedArticlesQuery = useLiveQuery((q) =>
    q
      .from({ articleTag: articleTagsCollection })
      .where(({ articleTag }) => eq(articleTag.tagId, tagId()))
      .select(({ articleTag }) => ({ id: articleTag.id }))
      .limit(1),
  );

  const hasContent = () =>
    (taggedFeedsQuery()?.length ?? 0) > 0 || (taggedArticlesQuery()?.length ?? 0) > 0;

  const navigate = useNavigate();
  createEffect(
    on(
      () => [hasContent(), tagId()] as const,
      ([has, id]) => {
        if (has && isOnIndex()) {
          navigate({ to: '/tags/$tagId/articles', params: { tagId: id }, replace: true });
        }
      },
    ),
  );

  return (
    <PageLayout
      title={
        tag() ? (
          <div class="flex items-center gap-2.5">
            <ColorIndicator class={getTagDotColor(tag()!.color)} />
            <span>{tag()!.name}</span>
          </div>
        ) : (
          'Tag'
        )
      }
    >
      <Show
        when={hasContent()}
        fallback={
          <Show when={feedsQuery()}>
            <TagEmptyState tagId={tagId()} feeds={feedsQuery()!} />
          </Show>
        }
      >
        <div role="tablist" class="tabs tabs-border mb-4">
          {TABS.map((tab) => (
            <Link
              to={tab.to}
              params={{ tagId: tagId() }}
              role="tab"
              class="tab"
              activeProps={{ class: 'tab tab-active' }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <Suspense fallback={<CenterLoader />}>
          <Outlet />
        </Suspense>
      </Show>
    </PageLayout>
  );
}
