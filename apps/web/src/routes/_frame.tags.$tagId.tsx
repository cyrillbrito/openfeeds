import { and, eq, ilike, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { ShortsButton } from '~/components/articles/ShortsButton';
import { ColorIndicator } from '~/components/ColorIndicator';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { TagEmptyState } from '~/components/TagFeedManager';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
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
  const { tagId } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnIndex = () => {
    const path = location.pathname;
    return path === `/tags/${tagId}` || path === `/tags/${tagId}/`;
  };

  const tags = useTags();
  const feeds = useFeeds();
  const tag = tags.find((t) => t.id === tagId);

  const { data: taggedFeeds } = useLiveQuery(
    (q) =>
      q
        .from({ feedTag: feedTagsCollection })
        .where(({ feedTag }) => eq(feedTag.tagId, tagId))
        .select(({ feedTag }) => ({ id: feedTag.id }))
        .orderBy(({ feedTag }) => feedTag.id)
        .limit(1),
    [tagId],
  );

  const { data: taggedArticles } = useLiveQuery(
    (q) =>
      q
        .from({ articleTag: articleTagsCollection })
        .where(({ articleTag }) => eq(articleTag.tagId, tagId))
        .select(({ articleTag }) => ({ id: articleTag.id }))
        .orderBy(({ articleTag }) => articleTag.id)
        .limit(1),
    [tagId],
  );

  const hasContent = (taggedFeeds?.length ?? 0) > 0 || (taggedArticles?.length ?? 0) > 0;

  const { data: shortsData } = useLiveQuery(
    (q) =>
      q
        .from({ article: articlesCollection })
        .innerJoin({ articleTag: articleTagsCollection }, ({ article, articleTag }) =>
          eq(article.id, articleTag.articleId),
        )
        .where(({ article, articleTag }) =>
          and(
            eq(articleTag.tagId, tagId),
            eq(article.isArchived, false),
            ilike(article.url, '%youtube.com/shorts%'),
          ),
        )
        .select(({ article }) => ({ id: article.id }))
        .orderBy(({ article }) => article.pubDate, 'desc')
        .limit(1),
    [tagId],
  );
  const shortsExist = (shortsData?.length ?? 0) > 0;

  useEffect(() => {
    if (hasContent && isOnIndex()) {
      void navigate({ to: '/tags/$tagId/articles', params: { tagId }, replace: true });
    }
  }, [hasContent, tagId, location.pathname]);

  return (
    <PageLayout
      title={
        tag ? (
          <div className="flex items-center gap-2.5">
            <ColorIndicator className={getTagDotColor(tag.color)} />
            <span>{tag.name}</span>
          </div>
        ) : (
          'Tag'
        )
      }
      headerActions={
        <ShortsButton
          shortsExist={shortsExist}
          linkProps={{
            to: '/tags/$tagId/shorts',
            params: { tagId },
            search: { readStatus: 'unread' },
          }}
        />
      }
    >
      {hasContent ? (
        <>
          <div role="tablist" className="tabs tabs-border mb-4">
            {TABS.map((tab) => (
              <Link
                key={tab.label}
                to={tab.to}
                params={{ tagId }}
                role="tab"
                className="tab"
                activeProps={{ className: 'tab tab-active' }}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <Suspense fallback={<CenterLoader />}>
            <Outlet />
          </Suspense>
        </>
      ) : (
        <TagEmptyState tagId={tagId} feeds={feeds} />
      )}
    </PageLayout>
  );
}
