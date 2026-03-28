import type { Feed, TagColor } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { debounce } from '@solid-primitives/scheduled';
import { eq, toArray, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import {
  CircleAlert,
  CloudDownload,
  EllipsisVertical,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-solid';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import { AvatarCheckbox } from '~/components/AvatarCheckbox';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MultiSelectTag } from '~/components/MultiSelectTag';
import { PageLayout } from '~/components/PageLayout';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { feedTagsCollection, useFeedTags } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.functions';
import { tagsCollection, useTags } from '~/entities/tags';
import { getTagDotColor } from '~/utils/tagColors';

const SEARCH_DEBOUNCE_MS = 200;

type FeedWithTags = Feed & {
  tags: { feedTagId: string; id: string | undefined; name: string | undefined; color: TagColor | null | undefined }[];
};

export const Route = createFileRoute('/_frame/feeds/')({
  component: FeedsComponent,
  validateSearch: (search): { q?: string } => {
    return {
      q: search?.q as any,
    };
  },
});

function FeedsComponent() {
  const feedsWithTagsQuery = useLiveQuery((q) =>
    q.from({ feed: feedsCollection }).select(({ feed }) => ({
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
  );
  const feedTagsQuery = useFeedTags();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  // Modal controllers
  let importOpmlModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let editFeedModalController!: ModalController;
  let syncLogsModalController!: ModalController;
  let bulkRetryModalController!: ModalController;
  let bulkAddTagsModalController!: ModalController;

  // Modal state
  const [feedsToDelete, setFeedsToDelete] = createSignal<FeedWithTags[]>([]);
  const [editingFeed, setEditingFeed] = createSignal<FeedWithTags | null>(null);
  const [syncLogsFeed, setSyncLogsFeed] = createSignal<FeedWithTags | null>(null);

  // Selection state — selection mode is entered by clicking a feed icon
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const isSelecting = () => selectedIds().size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const feeds = filteredFeeds();
    if (selectedIds().size === feeds.length) {
      setSelectedIds(new Set<string>());
    } else {
      setSelectedIds(new Set<string>(feeds.map((f) => f.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set<string>());

  const isAllSelected = () => {
    const feeds = filteredFeeds();
    return feeds.length > 0 && selectedIds().size === feeds.length;
  };

  // Search
  const [searchDebounced, setSearchDebounced] = createSignal(search()?.q ?? '');

  const setSearchDebounce = debounce((value: string) => {
    const newQ = value.toLowerCase().trim();
    void navigate({
      search: newQ ? { q: newQ } : {},
      replace: true,
    });
    setSearchDebounced(newQ);
    clearSelection();
  }, SEARCH_DEBOUNCE_MS);

  // Filtered feeds based on search query from URL, with broken/failing sorted to top
  const filteredFeeds = createMemo(() => {
    const feeds = feedsWithTagsQuery();
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

  // Bulk action handlers
  const handleBulkDelete = () => {
    setFeedsToDelete(filteredFeeds().filter((f) => selectedIds().has(f.id)) as FeedWithTags[]);
    deleteFeedModalController.open();
  };

  const handleBulkRetry = () => {
    bulkRetryModalController.open();
  };

  const handleBulkAddTags = () => {
    bulkAddTagsModalController.open();
  };

  const executeBulkRetry = () => {
    const ids = selectedIds();
    for (const feed of filteredFeeds()) {
      if (ids.has(feed.id) && (feed.syncStatus === 'failing' || feed.syncStatus === 'broken')) {
        feedsCollection.update(feed.id, (draft) => {
          draft.syncStatus = 'ok';
          draft.syncError = null;
        });
        void $$retryFeed({ data: { id: feed.id } });
      }
    }
    clearSelection();
  };

  const selectedFailingCount = () => {
    const ids = selectedIds();
    return filteredFeeds().filter(
      (f) => ids.has(f.id) && (f.syncStatus === 'failing' || f.syncStatus === 'broken'),
    ).length;
  };

  return (
    <PageLayout title="Feeds" mobileOnlyTitle>
      {/* Modals — always mounted so controllers are available */}
      <ImportOpmlModal controller={(controller) => (importOpmlModalController = controller)} />

      <DeleteFeedModal
        controller={(controller) => (deleteFeedModalController = controller)}
        feeds={feedsToDelete()}
        onDeleteComplete={() => {
          setFeedsToDelete([]);
          clearSelection();
        }}
      />

      <EditFeedModal
        controller={(controller) => (editFeedModalController = controller)}
        feed={editingFeed()}
      />

      <SyncLogsModal
        controller={(controller) => (syncLogsModalController = controller)}
        feed={syncLogsFeed()}
      />

      <BulkRetryModal
        controller={(controller) => (bulkRetryModalController = controller)}
        failingCount={selectedFailingCount}
        onConfirm={() => {
          executeBulkRetry();
          bulkRetryModalController.close();
        }}
      />

      <BulkAddTagsModal
        controller={(controller) => (bulkAddTagsModalController = controller)}
        selectedFeedIds={() =>
          filteredFeeds()
            .filter((f) => selectedIds().has(f.id))
            .map((f) => f.id)
        }
        feedTags={feedTagsQuery()}
        onComplete={clearSelection}
      />

      <Switch>
        <Match when={feedsWithTagsQuery() === undefined}>
          <CenterLoader />
        </Match>

        <Match when={feedsWithTagsQuery()?.length === 0}>
          <FeedsEmptyState onImportOpml={() => importOpmlModalController.open()} />
        </Match>

        <Match when={feedsWithTagsQuery() && feedsWithTagsQuery()!.length > 0}>
          {/* Header with title, action buttons, and search — only when feeds exist */}
          <FeedsHeader
            searchValue={searchDebounced()}
            onSearchChange={setSearchDebounce}
            onImportOpml={() => importOpmlModalController.open()}
          />

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
            {/* List header — shows count normally, switches to bulk actions when selecting */}
            <div class="group/header mt-4 flex h-8 items-center gap-3 px-2 pb-2 md:gap-4">
              {/* Select-all checkbox — always present, hidden until hover when not selecting */}
              <div class="flex w-8 shrink-0 items-center justify-center md:w-10">
                <input
                  type="checkbox"
                  class={`checkbox checkbox-sm transition-opacity ${isSelecting() ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
                  checked={isAllSelected()}
                  onChange={toggleSelectAll}
                />
              </div>

              <Show
                when={isSelecting()}
                fallback={
                  <span class="text-base-content/40 text-sm">
                    {filteredFeeds().length} feed{filteredFeeds().length !== 1 ? 's' : ''}
                  </span>
                }
              >
                <span class="text-sm font-medium">{selectedIds().size} selected</span>

                {/* Inline bulk actions */}
                <div class="flex items-center gap-1">
                  <Show when={selectedFailingCount() > 0}>
                    <button
                      class="btn btn-ghost btn-xs gap-1"
                      onClick={handleBulkRetry}
                      title="Retry failed feeds"
                    >
                      <RefreshCw size={14} />
                      <span class="hidden sm:inline">Retry</span>
                    </button>
                  </Show>
                  <button
                    class="btn btn-ghost btn-xs gap-1"
                    onClick={handleBulkAddTags}
                    title="Add tags to selected feeds"
                  >
                    <Tag size={14} />
                    <span class="hidden sm:inline">Tag</span>
                  </button>
                  <button
                    class="btn btn-ghost btn-xs text-error gap-1"
                    onClick={handleBulkDelete}
                    title="Unfollow selected feeds"
                  >
                    <Trash2 size={14} />
                    <span class="hidden sm:inline">Unfollow</span>
                  </button>
                </div>

                {/* Clear selection */}
                <button
                  class="btn btn-ghost btn-xs btn-circle ml-auto"
                  onClick={clearSelection}
                  title="Exit selection"
                >
                  <X size={14} />
                </button>
              </Show>
            </div>

            {/* Feed list rows */}
            <div>
              <For each={filteredFeeds()}>
                {(feed, i) => (
                  <>
                    <Show when={i() > 0}>
                      <hr class="border-base-content/8 mx-4" />
                    </Show>
                    <FeedRow
                      feed={feed}
                      selected={selectedIds().has(feed.id)}
                      onToggleSelect={() => toggleSelect(feed.id)}
                      onEdit={() => {
                        setEditingFeed(feed);
                        editFeedModalController.open();
                      }}
                      onDelete={() => {
                        setFeedsToDelete([feed]);
                        deleteFeedModalController.open();
                      }}
                      onRetry={() => {
                        feedsCollection.update(feed.id, (draft) => {
                          draft.syncStatus = 'ok';
                          draft.syncError = null;
                        });
                        void $$retryFeed({ data: { id: feed.id } });
                      }}
                      onViewLogs={() => {
                        setSyncLogsFeed(feed);
                        syncLogsModalController.open();
                      }}
                    />
                  </>
                )}
              </For>
            </div>
          </Show>
        </Match>
      </Switch>
    </PageLayout>
  );
}

// --- Empty State ---

interface FeedsEmptyStateProps {
  onImportOpml: () => void;
}

function FeedsEmptyState(props: FeedsEmptyStateProps) {
  return (
    <div class="py-16 text-center">
      <div class="mb-6 flex justify-center">
        <div class="bg-base-300/60 flex size-24 items-center justify-center rounded-full">
          <Rss size={40} class="text-base-content/30 translate-x-1 -translate-y-0.5" />
        </div>
      </div>

      <h2 class="mb-2 text-2xl font-bold">No Feeds Yet</h2>
      <p class="text-base-content/60 mx-auto mb-8 max-w-sm">
        Follow your favorite sources to get started.
      </p>

      <div class="flex flex-col justify-center gap-3 sm:flex-row">
        <button class="btn btn-outline" onClick={props.onImportOpml}>
          <CloudDownload size={18} />
          Import OPML
        </button>
        <Link to="/discover" class="btn btn-primary">
          <Plus size={18} />
          Discover
        </Link>
      </div>
    </div>
  );
}

// --- Header (title + actions + search) ---

interface FeedsHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onImportOpml: () => void;
}

function FeedsHeader(props: FeedsHeaderProps) {
  return (
    <div class="sm:py-4">
      <div class="mb-4 hidden items-center justify-between sm:flex">
        <h2 class="text-2xl font-bold sm:text-3xl">Feeds</h2>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onClick={props.onImportOpml}>
            <CloudDownload size={18} />
            Import OPML
          </button>
          <Link to="/discover" class="btn btn-primary btn-sm">
            <Plus size={18} />
            Discover
          </Link>
        </div>
      </div>

      <p class="text-base-content/60 mb-4">View and organize your feeds</p>

      {/* Mobile-only action buttons — above search */}
      <div class="mb-3 flex gap-2 sm:hidden">
        <button class="btn btn-outline btn-sm" onClick={props.onImportOpml}>
          <CloudDownload size={18} />
          Import OPML
        </button>
        <Link to="/discover" class="btn btn-primary btn-sm">
          <Plus size={18} />
          Discover
        </Link>
      </div>

      {/* Search Input */}
      <label class="input input-bordered flex w-full max-w-md items-center gap-2">
        <Search size={20} class="opacity-50" />
        <input
          type="search"
          placeholder="Search feeds..."
          class="grow"
          value={props.searchValue}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}

// --- Bulk Retry Modal ---

interface BulkRetryModalProps {
  controller: (controller: ModalController) => void;
  failingCount: () => number;
  onConfirm: () => void;
}

function BulkRetryModal(props: BulkRetryModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-sm"
      title="Retry sync?"
    >
      <p class="text-base-content/70 text-sm">
        <span class="text-base-content font-medium">{props.failingCount()}</span> failing feed
        {props.failingCount() !== 1 ? 's' : ''} will be cleared and retried.
      </p>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost btn-sm" onClick={() => modalController.close()}>
          Cancel
        </button>
        <button type="button" class="btn btn-primary btn-sm" onClick={props.onConfirm}>
          Retry
        </button>
      </div>
    </LazyModal>
  );
}

// --- Bulk Add Tags Modal ---

interface BulkAddTagsModalProps {
  controller: (controller: ModalController) => void;
  selectedFeedIds: () => string[];
  feedTags: ReturnType<typeof useFeedTags> extends () => infer T ? T : never;
  onComplete: () => void;
}

function BulkAddTagsModal(props: BulkAddTagsModalProps) {
  let modalController!: ModalController;
  const tagsQuery = useTags();
  const [selectedTagIds, setSelectedTagIds] = createSignal<string[]>([]);

  const handleApply = () => {
    const feedIds = props.selectedFeedIds();
    const tagIds = selectedTagIds();
    const existingFeedTags = props.feedTags ?? [];

    for (const feedId of feedIds) {
      const existingTagIds = new Set(
        existingFeedTags.filter((ft) => ft.feedId === feedId).map((ft) => ft.tagId),
      );

      const toInsert = tagIds.filter((tagId) => !existingTagIds.has(tagId));
      if (toInsert.length > 0) {
        feedTagsCollection.insert(
          toInsert.map((tagId) => ({
            id: createId(),
            userId: '',
            feedId,
            tagId,
          })),
        );
      }
    }

    setSelectedTagIds([]);
    modalController.close();
    props.onComplete();
  };

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-md"
      title="Add Tags"
      onClose={() => setSelectedTagIds([])}
    >
      <div class="mb-6">
        <p class="text-base-content/60 mb-4 text-sm">
          Add tags to{' '}
          <span class="text-base-content font-semibold">
            {props.selectedFeedIds().length} selected feed
            {props.selectedFeedIds().length !== 1 ? 's' : ''}
          </span>
          . Existing tags on each feed will be kept.
        </p>

        <Show
          when={tagsQuery() && tagsQuery()!.length > 0}
          fallback={
            <div class="py-8 text-center">
              <p class="text-base-content/60 mb-4">No tags available.</p>
              <Link to="/tags" class="btn btn-primary btn-sm">
                Create Tags
              </Link>
            </div>
          }
        >
          <MultiSelectTag
            tags={tagsQuery()!}
            selectedIds={selectedTagIds()}
            onSelectionChange={setSelectedTagIds}
          />
        </Show>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => modalController.close()}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled={selectedTagIds().length === 0}
          onClick={handleApply}
        >
          Add {selectedTagIds().length} tag{selectedTagIds().length !== 1 ? 's' : ''}
        </button>
      </div>
    </LazyModal>
  );
}

// --- Feed Icon ---

function FeedIcon(props: { feed: FeedWithTags }) {
  const [iconError, setIconError] = createSignal(false);

  return (
    <Show
      when={props.feed.icon && !iconError()}
      fallback={
        <div class="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
          <Rss size={14} class="text-base-content/50 md:size-4" />
        </div>
      }
    >
      <img
        src={props.feed.icon!}
        alt={props.feed.title}
        class="bg-base-300 size-8 rounded-full object-cover md:size-10"
        loading="lazy"
        draggable={false}
        onError={() => setIconError(true)}
      />
    </Show>
  );
}

// --- Feed Row ---

interface FeedRowProps {
  feed: FeedWithTags;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onViewLogs: () => void;
}

function FeedRow(props: FeedRowProps) {
  return (
    <div
      class="hover:bg-base-200/50 group relative flex items-start gap-3 rounded-lg px-2 py-3 transition-colors md:gap-4 md:py-4"
      classList={{ 'bg-base-200/30': props.selected }}
    >
      {/* Icon area — avatar doubles as selection checkbox */}
      <AvatarCheckbox selected={props.selected} onToggle={props.onToggleSelect} class="pt-0.5">
        <FeedIcon feed={props.feed} />
      </AvatarCheckbox>

      {/* Feed info */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <Link
            to="/feeds/$feedId"
            params={{ feedId: props.feed.id.toString() }}
            search={{ readStatus: 'unread' }}
            class="min-w-0"
          >
            <h3 class="hover:text-primary truncate text-sm font-medium transition-colors md:text-base">
              {props.feed.title}
            </h3>
          </Link>
          <Show when={props.feed.syncStatus === 'failing' || props.feed.syncStatus === 'broken'}>
            <span
              class={`badge badge-xs ${props.feed.syncStatus === 'broken' ? 'badge-error' : 'badge-warning'}`}
            >
              {props.feed.syncStatus === 'broken' ? 'Broken' : 'Failing'}
            </span>
          </Show>
        </div>

        <Show when={props.feed.description}>
          <p class="text-base-content/50 mt-0.5 line-clamp-3 text-xs leading-relaxed md:text-sm">
            {props.feed.description}
          </p>
        </Show>

        {/* Tags inline */}
        <Show when={props.feed.tags.length > 0}>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <For each={props.feed.tags}>
              {(tag) => (
                <Link to="/tags/$tagId" params={{ tagId: tag.id!.toString() }}>
                  <span class="badge badge-xs gap-1 transition-all hover:brightness-90">
                    <ColorIndicator class={getTagDotColor(tag.color as TagColor | null)} />
                    {tag.name}
                  </span>
                </Link>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Actions dropdown — always visible on touch, hover-only on desktop */}
      <div class="shrink-0 pt-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <Dropdown
          end
          btnClasses="btn-circle btn-ghost btn-sm"
          btnContent={<EllipsisVertical size={18} />}
        >
          <li>
            <button onClick={props.onEdit}>Edit</button>
          </li>
          <Show when={props.feed.syncStatus === 'failing' || props.feed.syncStatus === 'broken'}>
            <li>
              <button onClick={props.onRetry}>Retry Sync</button>
            </li>
          </Show>
          <li>
            <button onClick={props.onViewLogs}>Sync Logs</button>
          </li>
          <div class="divider my-0"></div>
          <li>
            <button class="text-error w-full text-left" onClick={props.onDelete}>
              Unfollow
            </button>
          </li>
        </Dropdown>
      </div>
    </div>
  );
}
