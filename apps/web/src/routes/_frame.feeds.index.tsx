import type { Feed } from '@repo/domain/client';
import { debounce } from '@solid-primitives/scheduled';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { CircleAlert, CloudDownload, EllipsisVertical, Plus, Search } from 'lucide-solid';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import { Card } from '~/components/Card';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import { FeedIllustration } from '~/components/Icons';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { useFeedTags } from '~/entities/feed-tags';
import { feedsCollection, useFeeds } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.functions';
import { useTags } from '~/entities/tags';
import { getTagDotColor } from '~/utils/tagColors';

const SEARCH_DEBOUNCE_MS = 200;

export const Route = createFileRoute('/_frame/feeds/')({
  component: FeedsComponent,
  validateSearch: (search): { q?: string } => {
    return {
      q: search?.q as any,
    };
  },
});

function FeedsComponent() {
  const feedsQuery = useFeeds();
  const feedTagsQuery = useFeedTags();
  const tagsQuery = useTags();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  // Modal controllers
  let importOpmlModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let editFeedModalController!: ModalController;
  let syncLogsModalController!: ModalController;

  // Modal state
  const [feedToDelete, setFeedToDelete] = createSignal<Feed | null>(null);
  const [editingFeed, setEditingFeed] = createSignal<Feed | null>(null);
  const [syncLogsFeed, setSyncLogsFeed] = createSignal<Feed | null>(null);

  // const [searchInput, setSearchInput] = createSignal(search()?.q ?? '');
  const [searchDebounced, setSearchDebounced] = createSignal(search()?.q ?? '');

  const setSearchDebounce = debounce((value: string) => {
    const newQ = value.toLowerCase().trim();
    navigate({
      search: newQ ? { q: newQ } : {},
      replace: true,
    });
    setSearchDebounced(newQ);
  }, SEARCH_DEBOUNCE_MS);

  // Filtered feeds based on search query from URL, with broken/failing sorted to top
  const filteredFeeds = createMemo(() => {
    const feeds = feedsQuery();
    if (!feeds) return [];

    let result = feeds;
    const query = searchDebounced();
    if (query) {
      result = result.filter(
        (feed) =>
          feed.title.toLowerCase().includes(query) ||
          feed.description?.toLowerCase().includes(query) ||
          feed.url.toLowerCase().includes(query),
      );
    }

    // Sort: broken first, then failing, then ok
    const statusOrder = { broken: 0, failing: 1, ok: 2 };
    return [...result].sort(
      (a, b) => statusOrder[a.syncStatus ?? 'ok'] - statusOrder[b.syncStatus ?? 'ok'],
    );
  });

  return (
    <PageLayout
      title="Manage Feeds"
      headerActions={
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onClick={() => importOpmlModalController.open()}>
            <CloudDownload size={20} />
            <span class="hidden sm:inline">Import OPML</span>
          </button>
          <Link to="/discover" class="btn btn-primary btn-sm">
            <Plus size={20} />
            <span class="hidden sm:inline">Add Feed</span>
          </Link>
        </div>
      }
    >
      <div class="mb-6">
        <p class="text-base-content-gray mb-4">View and organize your RSS feeds</p>

        {/* Search Input */}
        <label class="input input-bordered flex w-full max-w-md items-center gap-2">
          <Search size={24} class="h-[1em] opacity-50" />
          <input
            type="search"
            placeholder="Search feeds..."
            class="grow"
            value={searchDebounced()}
            onInput={(e) => setSearchDebounce(e.currentTarget.value)}
          />
        </label>
      </div>

      <ImportOpmlModal controller={(controller) => (importOpmlModalController = controller)} />

      <DeleteFeedModal
        controller={(controller) => (deleteFeedModalController = controller)}
        feed={feedToDelete()}
        onDeleteComplete={() => setFeedToDelete(null)}
      />

      <EditFeedModal
        controller={(controller) => (editFeedModalController = controller)}
        feed={editingFeed()}
      />

      <SyncLogsModal
        controller={(controller) => (syncLogsModalController = controller)}
        feed={syncLogsFeed()}
      />

      <Switch>
        {/* Loading state */}
        <Match when={feedsQuery() === undefined}>
          <CenterLoader />
        </Match>

        {/* Empty state - no feeds */}
        <Match when={feedsQuery()?.length === 0}>
          <div class="py-16 text-center">
            {/* RSS Feeds SVG Illustration */}
            <div class="mb-8 flex justify-center">
              <FeedIllustration />
            </div>

            <h2 class="mb-4 text-3xl font-bold">No RSS Feeds Yet</h2>
            <p class="text-base-content-gray mx-auto mb-8 max-w-md">
              Start building your personalized news feed by adding your favorite RSS sources. Stay
              updated with the latest content from blogs, news sites, and more.
            </p>

            <div class="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                class="btn btn-outline btn-lg"
                onClick={() => importOpmlModalController.open()}
              >
                <CloudDownload size={20} class="mr-2" />
                Import OPML
              </button>
              <Link to="/discover" class="btn btn-primary btn-lg">
                <Plus size={20} class="mr-2" />
                Add Your First Feed
              </Link>
            </div>

            <div class="text-base-content/50 mt-8 text-sm">
              <p>Not sure where to start? Try popular feeds like:</p>
              <div class="mt-3 flex flex-wrap justify-center gap-2">
                <span class="badge badge-outline">Tech News</span>
                <span class="badge badge-outline">Blog Posts</span>
                <span class="badge badge-outline">News Sites</span>
                <span class="badge badge-outline">Podcasts</span>
              </div>
            </div>
          </div>
        </Match>

        {/* Has feeds */}
        <Match when={feedsQuery() && feedsQuery()!.length > 0}>
          <Show
            when={filteredFeeds().length > 0}
            fallback={
              <div class="py-16 text-center">
                <div class="mb-4">
                  <CircleAlert size={64} class="text-base-content/30 mx-auto" />
                </div>
                <h2 class="mb-2 text-2xl font-bold">No feeds found</h2>
                <p class="text-base-content-gray">
                  No feeds match your search query "{search()?.q}"
                </p>
                <button class="btn btn-outline mt-4" onClick={() => setSearchDebounce('')}>
                  Clear search
                </button>
              </div>
            }
          >
            <div class="grid gap-3">
              <For each={filteredFeeds()}>
                {(feed) => (
                  <Card
                    class={`transition-shadow hover:shadow-md ${
                      feed.syncStatus === 'broken'
                        ? 'border-error/40'
                        : feed.syncStatus === 'failing'
                          ? 'border-warning/40'
                          : ''
                    }`}
                  >
                    <div class="relative">
                      {/* Actions Dropdown - Top Right */}
                      <div class="absolute top-0 right-0">
                        <Dropdown
                          end
                          btnClasses="btn-circle btn-ghost btn-sm"
                          btnContent={<EllipsisVertical size={20} />}
                        >
                          <li>
                            <button
                              onClick={() => {
                                setEditingFeed(feed);
                                editFeedModalController.open();
                              }}
                            >
                              Edit Feed
                            </button>
                          </li>
                          <Show
                            when={feed.syncStatus === 'failing' || feed.syncStatus === 'broken'}
                          >
                            <li>
                              <button
                                onClick={() => {
                                  feedsCollection.update(feed.id, (draft) => {
                                    draft.syncStatus = 'ok';
                                    draft.syncError = null;
                                  });
                                  $$retryFeed({ data: { id: feed.id } });
                                }}
                              >
                                Retry Sync
                              </button>
                            </li>
                          </Show>
                          <li>
                            <button
                              onClick={() => {
                                setSyncLogsFeed(feed);
                                syncLogsModalController.open();
                              }}
                            >
                              Sync Logs
                            </button>
                          </li>
                          <div class="divider my-0"></div>
                          <li>
                            <button
                              class="text-error w-full text-left"
                              onClick={() => {
                                setFeedToDelete(feed);
                                deleteFeedModalController.open();
                              }}
                            >
                              Delete Feed
                            </button>
                          </li>
                        </Dropdown>
                      </div>

                      {/* Content */}
                      <div class="flex items-start gap-3 pr-10 sm:gap-4">
                        {/* Feed Icon with lazy loading */}
                        <div class="bg-base-300 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg shadow-sm sm:h-16 sm:w-16 sm:rounded-xl md:h-20 md:w-20">
                          {feed.icon ? (
                            <img
                              src={feed.icon}
                              alt={`${feed.title} icon`}
                              class="h-14 w-14 rounded-lg object-cover sm:h-16 sm:w-16 sm:rounded-xl md:h-20 md:w-20"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                        </div>

                        {/* Feed Content */}
                        <div class="min-w-0 flex-1">
                          <div class="mb-1.5 flex items-center gap-2">
                            <Link
                              class="min-w-0"
                              to="/feeds/$feedId"
                              params={{ feedId: feed.id.toString() }}
                              search={{ readStatus: 'unread' }}
                            >
                              <h3 class="hover:text-primary truncate text-base font-semibold transition-colors sm:text-lg">
                                {feed.title}
                              </h3>
                            </Link>
                            <Show
                              when={feed.syncStatus === 'failing' || feed.syncStatus === 'broken'}
                            >
                              <span
                                class={`badge badge-xs ${feed.syncStatus === 'broken' ? 'badge-error' : 'badge-warning'}`}
                              >
                                {feed.syncStatus === 'broken' ? 'Broken' : 'Failing'}
                              </span>
                            </Show>
                          </div>

                          {feed.description && (
                            <p class="text-base-content/70 mb-3 line-clamp-2 text-sm leading-relaxed">
                              {feed.description}
                            </p>
                          )}

                          {/* Tags */}
                          {(() => {
                            const feedTagIds = () =>
                              (feedTagsQuery() ?? [])
                                .filter((ft) => ft.feedId === feed.id)
                                .map((ft) => ft.tagId);
                            return (
                              <Show when={feedTagIds().length > 0}>
                                <div class="mb-3 flex flex-wrap gap-1.5">
                                  <For each={feedTagIds()}>
                                    {(tagId) => {
                                      const tag = tagsQuery()?.find((t) => t.id === tagId);
                                      if (tag) {
                                        return (
                                          <Link
                                            to="/tags/$tagId"
                                            params={{ tagId: tag.id.toString() }}
                                          >
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

                          {/* Links */}
                          <div class="flex flex-wrap gap-3 text-xs">
                            <a
                              href={feed.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="link link-primary font-medium"
                            >
                              Website
                            </a>
                            <a
                              href={feed.feedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="link link-primary font-medium"
                            >
                              Feed URL
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </For>
            </div>
          </Show>
        </Match>
      </Switch>
    </PageLayout>
  );
}
