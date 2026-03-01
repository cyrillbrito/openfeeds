import type { Feed, FeedTag, Tag } from '@repo/domain/client';
import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { MoreVertical, TriangleAlert, Video } from 'lucide-solid';
import { createSignal, For, onMount, Show, Suspense, type Accessor } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { PageLayout } from '~/components/PageLayout';
import { ReadStatusToggle, type ReadStatus } from '~/components/ReadStatusToggle';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { articlesCollection } from '~/entities/articles';
import { useFeedTags } from '~/entities/feed-tags';
import { feedsCollection, useFeeds } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.functions';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/feeds/$feedId/')({
  validateSearch: validateReadStatusSearch,
  component: FeedArticles,
});

function FeedArticles() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const feedId = () => params()?.feedId;
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`feed:${feedId()}`));

  // Pagination state - lifted from ArticleList
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc').limit(visibleCount());
  });

  // Lightweight count query - only selects id to avoid tracking full article objects
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.select(({ article }) => ({ id: article.id }));
  });

  const feedsQuery = useFeeds();
  const feedTagsQuery = useFeedTags();
  const tagsQuery = useTags();

  let editFeedModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let markAllModalController!: ModalController;
  let syncLogsModalController!: ModalController;

  const [feedToDelete, setFeedToDelete] = createSignal<Feed | null>(null);
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
      const articleIds = (totalCountQuery() || []).map((a) => a.id);
      if (articleIds.length > 0) {
        articlesCollection.update(articleIds, (drafts) => {
          drafts.forEach((d) => (d.isArchived = true));
        });
      }
      markAllModalController.close();
    } catch (err) {
      console.error('Mark many archived failed:', err);
    } finally {
      setIsMarkingAllArchived(false);
    }
  };

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean },
  ) => {
    // Track session-read articles
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }

    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
    });
  };

  // Articles are already filtered by the live query (including session-read handling)
  const filteredArticles = () => articlesQuery() || [];

  const totalCount = () => (totalCountQuery() || []).length;

  const unreadCount = () => {
    return filteredArticles().filter((article) => !article.isRead).length;
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  const currentFeed = () => {
    const feeds = feedsQuery() || [];
    return feeds.find((feed) => feed.id === feedId()) || null;
  };

  return (
    <PageLayout
      title="Feed Articles"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <Link
            to="/feeds/$feedId/shorts"
            params={{ feedId: feedId().toString() }}
            search={{ readStatus: readStatus() }}
            class="btn btn-accent btn-sm"
          >
            <Video size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
          <Show when={currentFeed()}>
            <Dropdown end btnClasses="btn-sm" btnContent={<MoreVertical size={20} />}>
              <li>
                <button onClick={() => editFeedModalController.open()}>Edit Feed</button>
              </li>
              <li>
                <button onClick={() => syncLogsModalController.open()}>Sync Logs</button>
              </li>
              <div class="divider my-0"></div>
              <li>
                <button
                  class="text-error w-full text-left"
                  onClick={() => {
                    setFeedToDelete(currentFeed());
                    deleteFeedModalController.open();
                  }}
                >
                  Delete Feed
                </button>
              </li>
            </Dropdown>
          </Show>
        </div>
      }
    >
      {/* Sync error notice */}
      <Show
        when={
          (currentFeed()?.syncStatus === 'failing' || currentFeed()?.syncStatus === 'broken') &&
          currentFeed()
        }
        keyed
      >
        {(feed) => (
          <div class="border-base-300 bg-base-200 mb-4 rounded-lg border p-4">
            <div class="flex items-start gap-3">
              <TriangleAlert
                size={18}
                class={`mt-0.5 shrink-0 ${feed.syncStatus === 'broken' ? 'text-error' : 'text-warning'}`}
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">
                  {feed.syncStatus === 'broken'
                    ? 'Feed sync is broken'
                    : 'Feed is experiencing sync issues'}
                </p>
                <Show when={feed.syncError}>
                  <p class="text-base-content/60 mt-1 text-xs">{feed.syncError}</p>
                </Show>
                <div class="mt-3 flex gap-2">
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={async () => {
                      feedsCollection.update(feed.id, (draft) => {
                        draft.syncStatus = 'ok';
                        draft.syncError = null;
                      });
                      await $$retryFeed({ data: { id: feed.id } });
                    }}
                  >
                    Retry sync
                  </button>
                  <button
                    class="btn btn-ghost btn-sm text-error"
                    onClick={() => {
                      setFeedToDelete(feed);
                      deleteFeedModalController.open();
                    }}
                  >
                    Delete feed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      <Show when={currentFeed()} keyed>
        {(feed) => <FeedHeader feed={feed} feedTagsQuery={feedTagsQuery} tagsQuery={tagsQuery} />}
      </Show>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
            <MarkAllArchivedButton
              totalCount={unreadCount()}
              contextLabel="in this feed"
              onConfirm={handleMarkAllArchived}
            />
          </Show>
        }
        mobileMenuContent={
          <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
            <li>
              <button onClick={() => markAllModalController.open()}>
                Mark All Archived ({unreadCount()})
              </button>
            </li>
          </Show>
        }
        unreadCount={unreadCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <Suspense fallback={<CenterLoader />}>
        <Show when={feedsQuery() && tagsQuery()}>
          <ArticleList
            articles={filteredArticles()}
            feeds={feedsQuery()!}
            tags={tagsQuery()!}
            totalCount={totalCount()}
            onLoadMore={handleLoadMore}
            onUpdateArticle={handleUpdateArticle}
            readStatus={readStatus()}
            context="feed"
          />
        </Show>
      </Suspense>

      <EditFeedModal
        controller={(controller) => (editFeedModalController = controller)}
        feed={currentFeed()}
      />

      <DeleteFeedModal
        controller={(controller) => (deleteFeedModalController = controller)}
        feed={feedToDelete()}
        onDeleteComplete={() => setFeedToDelete(null)}
      />

      <SyncLogsModal
        controller={(controller) => (syncLogsModalController = controller)}
        feed={currentFeed()}
      />

      <LazyModal
        controller={(controller) => (markAllModalController = controller)}
        class="max-w-md"
        title="Mark All as Archived"
      >
        <div class="mb-6">
          <p class="mb-4">
            Are you sure you want to mark all unarchived articles as archived in this feed? This
            action cannot be undone.
          </p>

          <Show when={unreadCount() > 0}>
            <div class="bg-base-200 rounded-lg p-4">
              <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
              <p class="font-medium">
                {unreadCount()} unarchived article{unreadCount() !== 1 ? 's' : ''}
              </p>
            </div>
          </Show>
        </div>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onClick={() => markAllModalController.close()}
            disabled={isMarkingAllArchived()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={handleMarkAllArchived}
            disabled={isMarkingAllArchived()}
          >
            <Show when={isMarkingAllArchived()}>
              <span class="loading loading-spinner loading-sm"></span>
            </Show>
            {isMarkingAllArchived() ? 'Archiving...' : 'Mark All Archived'}
          </button>
        </div>
      </LazyModal>
    </PageLayout>
  );
}

function FeedHeader(props: {
  feed: Feed;
  feedTagsQuery: Accessor<FeedTag[] | undefined>;
  tagsQuery: Accessor<Tag[] | undefined>;
}) {
  const feedTagIds = () =>
    (props.feedTagsQuery() ?? []).filter((ft) => ft.feedId === props.feed.id).map((ft) => ft.tagId);

  return (
    <div class="mb-4 flex items-start gap-4 sm:gap-5">
      <Show when={props.feed.icon}>
        <div class="bg-base-300 flex h-20 w-20 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28">
          <img
            src={props.feed.icon!}
            alt={`${props.feed.title} icon`}
            class="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </Show>
      <div class="min-w-0 flex-1">
        <h2 class="mb-1.5 text-lg font-semibold sm:text-2xl">{props.feed.title}</h2>
        <p class="text-base-content/70 mb-3 line-clamp-3 text-sm leading-relaxed">
          {props.feed.description || 'No description found'}
        </p>

        {/* Tags */}
        <Show when={feedTagIds().length > 0}>
          <div class="mb-3 flex flex-wrap gap-1.5">
            <For each={feedTagIds()}>
              {(tagId) => {
                const tag = () => props.tagsQuery()?.find((t) => t.id === tagId);
                return (
                  <Show when={tag()}>
                    {(t) => (
                      <Link to="/tags/$tagId" params={{ tagId: t().id.toString() }}>
                        <div class="badge badge-sm gap-1.5 transition-all hover:brightness-90">
                          <ColorIndicator class={getTagDotColor(t().color)} />
                          <span>{t().name}</span>
                        </div>
                      </Link>
                    )}
                  </Show>
                );
              }}
            </For>
          </div>
        </Show>

        <div class="flex flex-wrap gap-3 text-xs">
          <a
            href={props.feed.url}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-primary font-medium"
          >
            Website
          </a>
          <a
            href={props.feed.feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-primary font-medium"
          >
            Feed URL
          </a>
        </div>
      </div>
    </div>
  );
}
