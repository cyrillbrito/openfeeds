import type { Feed } from '@repo/domain/client';
import { debounce } from '@solid-primitives/scheduled';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { CircleAlert, CloudDownload, EllipsisVertical, Plus, Search } from 'lucide-solid';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import { AddFeedModal } from '~/components/AddFeedModal';
import { Card } from '~/components/Card';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import { Header } from '~/components/Header';
import { FeedIllustration } from '~/components/Icons';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import { type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { useFeeds } from '~/entities/feeds';
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
  const tagsQuery = useTags();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  // Modal controllers
  let addFeedModalController!: ModalController;
  let importOpmlModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let editFeedModalController!: ModalController;

  // Modal state
  const [feedToDelete, setFeedToDelete] = createSignal<Feed | null>(null);
  const [editingFeed, setEditingFeed] = createSignal<Feed | null>(null);

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

  // Filtered feeds based on search query from URL
  const filteredFeeds = createMemo(() => {
    const feeds = feedsQuery.data;
    if (!feeds) return [];

    const query = searchDebounced();
    if (!query) return feeds;

    return feeds.filter(
      (feed) =>
        feed.title.toLowerCase().includes(query) ||
        feed.description?.toLowerCase().includes(query) ||
        feed.url.toLowerCase().includes(query),
    );
  });

  return (
    <>
      <Header title="Manage Feeds">
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onClick={() => importOpmlModalController.open()}>
            <CloudDownload size={20} />
            <span class="hidden sm:inline">Import OPML</span>
          </button>
          <button class="btn btn-primary btn-sm" onClick={() => addFeedModalController.open()}>
            <Plus size={20} />
            <span class="hidden sm:inline">Add Feed</span>
          </button>
        </div>
      </Header>

      <div class="mx-auto w-full max-w-2xl overflow-hidden px-2 py-3 sm:p-6 xl:max-w-3xl">
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

        <AddFeedModal controller={(controller) => (addFeedModalController = controller)} />

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

        <Switch>
          {/* Loading state */}
          <Match when={feedsQuery.data === undefined}>
            <CenterLoader />
          </Match>

          {/* Empty state - no feeds */}
          <Match when={feedsQuery.data?.length === 0}>
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
                <button
                  class="btn btn-primary btn-lg"
                  onClick={() => addFeedModalController.open()}
                >
                  <Plus size={20} class="mr-2" />
                  Add Your First Feed
                </button>
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
          <Match when={feedsQuery.data && feedsQuery.data.length > 0}>
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
              <div class="grid w-full gap-3">
                <For each={filteredFeeds()}>
                  {(feed) => (
                    <Card class="transition-shadow hover:shadow-md">
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
                            <div class="mb-1.5">
                              <Link
                                to="/feeds/$feedId"
                                params={{ feedId: feed.id.toString() }}
                                search={{ readStatus: 'unread' }}
                              >
                                <h3 class="hover:text-primary truncate text-base font-semibold transition-colors sm:text-lg">
                                  {feed.title}
                                </h3>
                              </Link>
                            </div>

                            {feed.description && (
                              <p class="text-base-content/70 mb-3 line-clamp-2 text-sm leading-relaxed">
                                {feed.description}
                              </p>
                            )}

                            {/* Tags */}
                            <Show when={feed.tags && feed.tags.length > 0}>
                              <div class="mb-3 flex flex-wrap gap-1.5">
                                <For each={feed.tags}>
                                  {(tagId) => {
                                    const tag = tagsQuery.data?.find((t) => t.id === tagId);
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

                            {/* Links */}
                            <div class="flex flex-wrap gap-3 text-xs">
                              <a
                                href={feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link link-primary font-medium"
                              >
                                Channel
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
      </div>
    </>
  );
}
