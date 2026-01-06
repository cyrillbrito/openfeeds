import type { Feed, MarkManyArchivedRequest } from '@repo/shared/types';
import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link, useSearch } from '@tanstack/solid-router';
import { markManyArchived } from '~/entities/actions';
import { articlesCollection, updateArticle } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import MoreVerticalIcon from 'lucide-solid/icons/more-vertical';
import ShuffleIcon from 'lucide-solid/icons/shuffle';
import VideoIcon from 'lucide-solid/icons/video';
import { createSignal, For, Show, Suspense } from 'solid-js';
import { validateReadStatusSearch } from '../common/routing';
import { ArticleList } from '../components/ArticleList';
import { ArticleListToolbar } from '../components/ArticleListToolbar';
import { ColorIndicator } from '../components/ColorIndicator';
import { DeleteFeedModal } from '../components/DeleteFeedModal';
import { Dropdown } from '../components/Dropdown';
import { EditFeedModal } from '../components/EditFeedModal';
import { Header } from '../components/Header';
import { LazyModal, type ModalController } from '../components/LazyModal';
import { MarkAllArchivedButton } from '../components/MarkAllArchivedButton';
import { ReadStatusToggle, type ReadStatus } from '../components/ReadStatusToggle';
import { ShuffleButton } from '../components/ShuffleButton';
import { getTagDotColor } from '../utils/tagColors';

export const Route = createFileRoute('/_frame/feeds/$feedId/')({
  validateSearch: validateReadStatusSearch,
  component: FeedArticles,
});

function FeedArticles() {
  const params = Route.useParams();
  const search = useSearch({ from: '/_frame/feeds/$feedId/' });
  const feedId = () => {
    const id = params().feedId;
    return id ? Number(id) : 0;
  };
  const readStatus = (): ReadStatus => search().readStatus || 'unread';
  const seed = () => search().seed;

  const isRead = () => (readStatus() === 'read' ? true : readStatus() === 'unread' ? false : null);

  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    if (isRead() !== null) {
      query = query.where(({ article }) => eq(article.isRead, isRead()));
    }

    return query;
  });

  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  let editFeedModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let markAllModalController!: ModalController;

  const [feedToDelete, setFeedToDelete] = createSignal<Feed | null>(null);
  const [isMarkingAllArchived, setIsMarkingAllArchived] = createSignal(false);

  const handleMarkAllArchived = async () => {
    try {
      setIsMarkingAllArchived(true);
      const request: MarkManyArchivedRequest = {
        context: 'feed',
        feedId: feedId(),
      };
      await markManyArchived(request);
      markAllModalController.close();
    } catch (err) {
      console.error('Mark many archived failed:', err);
    } finally {
      setIsMarkingAllArchived(false);
    }
  };

  const handleUpdateArticle = (
    articleId: number,
    updates: { isRead?: boolean; tags?: number[] },
  ) => {
    updateArticle(articleId, updates);
  };

  const articles = () => articlesQuery.data || [];

  const unreadCount = () => {
    return articles().filter((article) => !article.isRead).length;
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
            <VideoIcon size={20} />
            <span class="hidden sm:inline">Shorts</span>
          </Link>
          <Show when={currentFeed()}>
            <Dropdown end btnClasses="btn-sm" btnContent={<MoreVerticalIcon size={20} />}>
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

      <div class="container mx-auto p-3 sm:p-6">
        <div class="mb-6">
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
                  <Show when={feed().tags && feed().tags.length > 0}>
                    <div class="mb-3 flex flex-wrap gap-1.5">
                      <For each={feed().tags}>
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
      </div>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <>
            <ShuffleButton currentSeed={seed()} />
            <Show when={unreadCount() > 0 && readStatus() === 'unread'}>
              <MarkAllArchivedButton
                context="feed"
                feedId={feedId()}
                totalCount={unreadCount()}
                contextLabel="in this feed"
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
                <ShuffleIcon size={16} />
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
        totalCount={articles().length}
        readStatus={readStatus()}
      />

      <div class="container mx-auto px-3 pb-3 sm:px-6 sm:pb-6">
        <Suspense
          fallback={
            <div class="flex justify-center py-12">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          }
        >
          <Show
            when={feedsQuery.data && tagsQuery.data}
            fallback={
              <>
                {() => {
                  alert('when={feedsQuery.data && tagsQuery.data}');
                  return <>SHOW FALLBACK</>;
                }}
              </>
            }
          >
            <ArticleList
              articles={articles()}
              feeds={feedsQuery.data!}
              tags={tagsQuery.data!}
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
