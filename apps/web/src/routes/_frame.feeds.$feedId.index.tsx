import type { Feed } from '@repo/domain/client';
import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { MoreVertical, Shuffle, TriangleAlert, Video } from 'lucide-solid';
import { createMemo, createSignal, For, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import { Header } from '~/components/Header';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '~/components/ReadStatusToggle';
import { ShuffleButton } from '~/components/ShuffleButton';
import { articlesCollection } from '~/entities/articles';
import { useFeedTags } from '~/entities/feed-tags';
import { feedsCollection, useFeeds } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.server';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
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
  const seed = () => search()?.seed;
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`feed:${feedId()}`));

  // Pagination state - lifted from ArticleList
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Only filter by isRead on server when showing 'read' status
  const isRead = () => (readStatus() === 'read' ? true : null);

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc').limit(visibleCount());
  });

  // Query for total count (without limit)
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  const feedsQuery = useFeeds();
  const feedTagsQuery = useFeedTags();
  const tagsQuery = useTags();

  let editFeedModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let markAllModalController!: ModalController;

  const [feedToDelete, setFeedToDelete] = createSignal<Feed | null>(null);
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
      const articleIds = (totalCountQuery.data || []).map((a) => a.id);
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

  // Filter for session-read articles (client-side)
  const filteredArticles = createMemo(() => {
    const articles = articlesQuery.data || [];
    if (readStatus() !== 'unread') return articles;

    return articles.filter((a) => !a.isRead || sessionReadIds().has(a.id));
  });

  const totalCount = () => {
    const allArticles = totalCountQuery.data || [];
    if (readStatus() !== 'unread') return allArticles.length;

    return allArticles.filter((a) => !a.isRead || sessionReadIds().has(a.id)).length;
  };

  const unreadCount = () => {
    return filteredArticles().filter((article) => !article.isRead).length;
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  const currentFeed = () => {
    const feeds = feedsQuery.data || [];
    return feeds.find((feed) => feed.id === feedId()) || null;
  };

  return (
    <>
      <Header title="Feed Articles">
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
      </Header>

      <div class="mx-auto w-full max-w-2xl px-2 py-3 sm:p-6 xl:max-w-3xl">
        {/* Sync error banner */}
        <Show
          when={
            (currentFeed()?.syncStatus === 'failing' || currentFeed()?.syncStatus === 'broken') &&
            currentFeed()
          }
        >
          {(feed) => (
            <div
              class={`alert mb-4 ${feed().syncStatus === 'broken' ? 'alert-error' : 'alert-warning'}`}
            >
              <TriangleAlert size={20} />
              <div class="flex-1">
                <p class="font-semibold">
                  {feed().syncStatus === 'broken'
                    ? 'Feed sync is broken'
                    : 'Feed is experiencing sync issues'}
                </p>
                <Show when={feed().syncError}>
                  <p class="mt-1 text-sm opacity-80">{feed().syncError}</p>
                </Show>
                <p class="mt-1 text-xs opacity-60">
                  {feed().syncFailCount} consecutive failure
                  {feed().syncFailCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-sm"
                  onClick={async () => {
                    // Optimistically reset the local state
                    feedsCollection.update(feed().id, (draft) => {
                      draft.syncStatus = 'ok';
                      draft.syncFailCount = 0;
                      draft.syncError = null;
                    });
                    await $$retryFeed({ data: { id: feed().id } });
                  }}
                >
                  Retry
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFeedToDelete(feed());
                    deleteFeedModalController.open();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </Show>

        <Show when={currentFeed()}>
          {(feed) => (
            <div class="mb-4 flex items-start gap-4 sm:gap-5">
              <Show when={feed().icon}>
                <div class="bg-base-300 flex h-20 w-20 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28">
                  <img
                    src={feed().icon!}
                    alt={`${feed().title} icon`}
                    class="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </Show>
              <div class="min-w-0 flex-1">
                <h2 class="mb-1.5 text-lg font-semibold sm:text-2xl">{feed().title}</h2>
                <p class="text-base-content/70 mb-3 line-clamp-3 text-sm leading-relaxed">
                  {feed().description || 'No description found'}
                </p>

                {/* Tags */}
                {(() => {
                  const feedTagIds = () =>
                    (feedTagsQuery.data ?? [])
                      .filter((ft) => ft.feedId === feed().id)
                      .map((ft) => ft.tagId);
                  return (
                    <Show when={feedTagIds().length > 0}>
                      <div class="mb-3 flex flex-wrap gap-1.5">
                        <For each={feedTagIds()}>
                          {(tagId) => {
                            const tag = tagsQuery.data?.find((t) => t.id === tagId);
                            if (tag) {
                              return (
                                <Link to="/tags/$tagId" params={{ tagId: tag.id.toString() }}>
                                  <div class="badge badge-sm gap-1.5 transition-all hover:brightness-90">
                                    <ColorIndicator class={getTagDotColor(tag.color)} />
                                    <span>{tag.name}</span>
                                  </div>
                                </Link>
                              );
                            } else {
                              return <></>;
                            }
                          }}
                        </For>
                      </div>
                    </Show>
                  );
                })()}

                <div class="flex flex-wrap gap-3 text-xs">
                  <a
                    href={feed().url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary font-medium"
                  >
                    Channel
                  </a>
                  <a
                    href={feed().feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary font-medium"
                  >
                    Feed URL
                  </a>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <>
            <ShuffleButton currentSeed={seed()} />
            <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
              <MarkAllArchivedButton
                totalCount={unreadCount()}
                contextLabel="in this feed"
                onConfirm={handleMarkAllArchived}
              />
            </Show>
          </>
        }
        mobileMenuContent={
          <>
            <li>
              <Link
                to="."
                search={(prev: Record<string, any>) =>
                  prev.seed
                    ? { ...prev, seed: undefined }
                    : { ...prev, seed: Math.floor(Math.random() * 9999999999) + 1000000000 }
                }
              >
                <Shuffle size={16} />
                {seed() ? 'Turn off shuffle' : 'Shuffle'}
              </Link>
            </li>
            <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
              <li>
                <button onClick={() => markAllModalController.open()}>
                  Mark All Archived ({unreadCount()})
                </button>
              </li>
            </Show>
          </>
        }
        unreadCount={unreadCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <div class="mx-auto w-full max-w-2xl px-2 pb-3 sm:px-6 sm:pb-6 xl:max-w-3xl">
        <Suspense fallback={<CenterLoader />}>
          <Show when={feedsQuery.data && tagsQuery.data}>
            <ArticleList
              articles={filteredArticles()}
              feeds={feedsQuery.data!}
              tags={tagsQuery.data!}
              totalCount={totalCount()}
              onLoadMore={handleLoadMore}
              onUpdateArticle={handleUpdateArticle}
              readStatus={readStatus()}
              context="feed"
            />
          </Show>
        </Suspense>
      </div>

      <EditFeedModal
        controller={(controller) => (editFeedModalController = controller)}
        feed={currentFeed()}
      />

      <DeleteFeedModal
        controller={(controller) => (deleteFeedModalController = controller)}
        feed={feedToDelete()}
        onDeleteComplete={() => setFeedToDelete(null)}
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
            {isMarkingAllArchived() && <span class="loading loading-spinner loading-sm"></span>}
            {isMarkingAllArchived() ? 'Archiving...' : 'Mark All Archived'}
          </button>
        </div>
      </LazyModal>
    </>
  );
}
