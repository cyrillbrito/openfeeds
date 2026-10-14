// oxlint-disable import/max-dependencies
import type { Feed, TagColor } from '@repo/domain/client';
import { and, eq, toArray, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute, Link } from '@tanstack/react-router';
import { MoreVertical, TriangleAlert } from 'lucide-react';
import { Suspense, useRef, useState } from 'react';
import { ArticleList } from '~/components/articles/ArticleList';
import {
  ArticleListProvider,
  useArticleList,
  type ArticleQueryFilter,
} from '~/components/articles/ArticleListContext';
import { ArticleListToolbar } from '~/components/articles/ArticleListToolbar';
import { MarkAllArchivedButton } from '~/components/articles/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '~/components/articles/ReadStatusToggle';
import { ShortsButton } from '~/components/articles/ShortsButton';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { tagsCollection } from '~/entities/tags';
import { api, unwrap } from '~/lib/api-client';
import { validateReadStatusSearch } from '~/utils/routing';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/feeds/$feedId/')({
  validateSearch: validateReadStatusSearch,
  component: FeedArticles,
});

type FeedWithTags = Feed & {
  tags: {
    feedTagId: string;
    id: string | undefined;
    name: string | undefined;
    color: TagColor | null | undefined;
  }[];
};

function FeedArticles() {
  const { feedId } = Route.useParams();
  const search = Route.useSearch();
  const readStatus: ReadStatus = search?.readStatus || 'unread';

  const filter: ArticleQueryFilter = {
    buildQuery: (q, { readStatusWhere }) =>
      q.from({ article: articlesCollection }).where(({ article }: any) => {
        const base = eq(article.feedId, feedId);
        return readStatusWhere ? and(base, readStatusWhere(article)) : base;
      }),
    buildCountQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => {
          const base = eq(article.feedId, feedId);
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ id: article.id })),
    buildUnreadQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => and(eq(article.feedId, feedId), eq(article.isRead, false)))
        .select(({ article }: any) => ({ id: article.id })),
    buildArchivableQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) =>
          and(eq(article.feedId, feedId), eq(article.isArchived, false)),
        )
        .select(({ article }: any) => ({ id: article.id })),
  };

  return (
    <ArticleListProvider filter={filter} readStatus={readStatus} viewKey={`feed:${feedId}`} context="feed">
      <FeedArticlesContent feedId={feedId} readStatus={readStatus} />
    </ArticleListProvider>
  );
}

function FeedArticlesContent({ feedId, readStatus }: { feedId: string; readStatus: ReadStatus }) {
  const ctx = useArticleList();

  const { data: feedWithTagsData } = useLiveQuery(
    (q) =>
      q
        .from({ feed: feedsCollection })
        .where(({ feed }) => eq(feed.id, feedId))
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
    [feedId],
  );

  const editFeedModalRef = useRef<ModalController>(null!);
  const deleteFeedModalRef = useRef<ModalController>(null!);
  const syncLogsModalRef = useRef<ModalController>(null!);

  const [feedToDelete, setFeedToDelete] = useState<FeedWithTags | null>(null);

  const currentFeed = (feedWithTagsData ?? [])[0] ?? null;

  return (
    <PageLayout
      title="Feed Articles"
      headerActions={
        <div className="flex flex-wrap gap-2">
          <ShortsButton
            shortsExist={ctx.shortsExist}
            linkProps={{
              to: '/feeds/$feedId/shorts',
              params: { feedId },
              search: { readStatus },
            }}
          />
          {currentFeed && (
            <Dropdown end btnClasses="btn-sm" btnContent={<MoreVertical size={20} />}>
              <li>
                <button onClick={() => editFeedModalRef.current.open()}>Edit</button>
              </li>
              <li>
                <button onClick={() => syncLogsModalRef.current.open()}>Sync Logs</button>
              </li>
              <div className="divider my-0"></div>
              <li>
                <button
                  className="text-error w-full text-left"
                  onClick={() => {
                    setFeedToDelete(currentFeed);
                    deleteFeedModalRef.current.open();
                  }}
                >
                  Unfollow
                </button>
              </li>
            </Dropdown>
          )}
        </div>
      }
    >
      {(currentFeed?.syncStatus === 'failing' || currentFeed?.syncStatus === 'broken') && currentFeed && (
        <div className="border-base-300 bg-base-200 mb-4 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert
              size={18}
              className={`mt-0.5 shrink-0 ${currentFeed.syncStatus === 'broken' ? 'text-error' : 'text-amber-600 dark:text-amber-400'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {currentFeed.syncStatus === 'broken'
                  ? 'Feed sync is broken'
                  : 'Feed is experiencing sync issues'}
              </p>
              {currentFeed.syncError && (
                <p className="text-base-content/60 mt-1 text-xs">{currentFeed.syncError}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={async () => {
                    feedsCollection.update(currentFeed.id, (draft) => {
                      draft.syncStatus = 'ok';
                      draft.syncError = null;
                    });
                    await unwrap(api.api.feeds.retry.$post({ json: { id: currentFeed.id } }));
                  }}
                >
                  Retry sync
                </button>
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => {
                    setFeedToDelete(currentFeed);
                    deleteFeedModalRef.current.open();
                  }}
                >
                  Unfollow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentFeed && <FeedHeader feed={currentFeed} />}

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus} />}
        menuContent={
          ctx.archivableCount > 0 ? (
            <li>
              <MarkAllArchivedButton
                totalCount={ctx.archivableCount}
                contextLabel="in this feed"
                onConfirm={ctx.markAllArchived}
              />
            </li>
          ) : null
        }
        unreadCount={ctx.unreadCount}
        totalCount={ctx.totalCount}
        readStatus={readStatus}
      />

      <Suspense fallback={<CenterLoader />}>
        {(ctx.feeds.length > 0 || ctx.tags.length > 0 || ctx.articles.length > 0) && (
          <ArticleList />
        )}
      </Suspense>

      <EditFeedModal
        controller={(c) => {
          editFeedModalRef.current = c;
        }}
        feed={currentFeed}
      />

      <DeleteFeedModal
        controller={(c) => {
          deleteFeedModalRef.current = c;
        }}
        feeds={feedToDelete ? [feedToDelete] : []}
        onDeleteComplete={() => setFeedToDelete(null)}
      />

      <SyncLogsModal
        controller={(c) => {
          syncLogsModalRef.current = c;
        }}
        feed={currentFeed}
      />
    </PageLayout>
  );
}

function FeedHeader({ feed }: { feed: FeedWithTags }) {
  return (
    <div className="mb-4 flex items-start gap-4 sm:gap-5">
      {feed.icon && (
        <div className="bg-base-300 flex h-20 w-20 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28">
          <img
            src={feed.icon}
            alt={`${feed.title} icon`}
            className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="mb-1.5 text-lg font-semibold sm:text-2xl">{feed.title}</h2>
        <p className="text-base-content/70 mb-3 line-clamp-3 text-sm leading-relaxed">
          {feed.description || 'No description found'}
        </p>

        {feed.tags && feed.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {feed.tags.map((tag) => (
              <Link key={tag.feedTagId} to="/tags/$tagId" params={{ tagId: tag.id! }}>
                <div className="badge badge-sm gap-1.5 transition-all hover:brightness-90">
                  <ColorIndicator className={getTagDotColor(tag.color ?? null)} />
                  <span>{tag.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs">
          <a
            href={feed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary font-medium"
          >
            Website
          </a>
          <a
            href={feed.feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary font-medium"
          >
            Feed URL
          </a>
        </div>
      </div>
    </div>
  );
}
