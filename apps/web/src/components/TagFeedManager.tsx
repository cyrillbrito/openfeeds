import type { Feed, FeedTag } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { autofocus } from '@solid-primitives/autofocus';
import { Check, Plus, Rss, Search, X } from 'lucide-solid';
import { createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js';
import { feedTagsCollection } from '~/entities/feed-tags';
import { TagsIllustration } from './Icons';

// prevents from being tree-shaken by TS
void autofocus;

let counter = 0;

interface TagFeedsTabProps {
  tagId: string;
  feeds: Feed[];
  feedTags: FeedTag[];
}

export function TagFeedsTab(props: TagFeedsTabProps) {
  const assignedFeedIds = () => new Set(props.feedTags.map((ft) => ft.feedId));
  const assignedFeeds = () => props.feeds.filter((f) => assignedFeedIds().has(f.id));
  const unassignedFeeds = () => props.feeds.filter((f) => !assignedFeedIds().has(f.id));

  const handleAddFeed = (feedId: string) => {
    feedTagsCollection.insert({
      id: createId(),
      userId: '',
      feedId,
      tagId: props.tagId,
    });
  };

  const handleRemoveFeed = (feedId: string) => {
    const existing = props.feedTags.find((ft) => ft.feedId === feedId);
    if (existing) {
      feedTagsCollection.delete(existing.id);
    }
  };

  return (
    <div class="mx-auto w-full max-w-2xl px-4 pb-3 sm:px-6 sm:pb-6 xl:max-w-3xl">
      {/* Assigned feeds list */}
      <div class="space-y-1">
        <For each={assignedFeeds()}>
          {(feed) => (
            <div class="hover:bg-base-200 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
              <Show
                when={feed.icon}
                fallback={
                  <div class="bg-base-200 flex h-8 w-8 items-center justify-center rounded">
                    <Rss size={14} class="text-base-content/40" />
                  </div>
                }
              >
                <img src={feed.icon!} alt="" class="h-8 w-8 rounded" loading="lazy" />
              </Show>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{feed.title}</p>
                <Show when={feed.description}>
                  <p class="text-base-content/50 truncate text-xs">{feed.description}</p>
                </Show>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square"
                onClick={() => handleRemoveFeed(feed.id)}
                aria-label={`Remove ${feed.title}`}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </For>
      </div>

      {/* Add more feeds */}
      <Show when={unassignedFeeds().length > 0}>
        <AddFeedsSection feeds={unassignedFeeds()} onAddFeed={handleAddFeed} />
      </Show>
    </div>
  );
}

// --- Empty state ---

interface TagEmptyStateProps {
  tagId: string;
  feeds: Feed[];
}

export function TagEmptyState(props: TagEmptyStateProps) {
  const handleAddFeed = (feedId: string) => {
    feedTagsCollection.insert({
      id: createId(),
      userId: '',
      feedId,
      tagId: props.tagId,
    });
  };

  return (
    <div class="mx-auto w-full max-w-2xl px-4 py-3 sm:p-6 xl:max-w-3xl">
      <div class="py-16 text-center">
        <div class="mb-4 flex justify-center">
          <TagsIllustration />
        </div>
        <h2 class="mb-2 text-2xl font-semibold">Nothing Here Yet</h2>
        <p class="text-base-content/60 mb-6">
          Assign feeds to this tag so their articles appear here.
        </p>
        <Show
          when={props.feeds.length > 0}
          fallback={
            <p class="text-base-content/40 text-sm">
              You don't have any feeds yet. Add some RSS feeds first.
            </p>
          }
        >
          <AddFeedsSection feeds={props.feeds} onAddFeed={handleAddFeed} />
        </Show>
      </div>
    </div>
  );
}

// --- Add feeds popover section ---

interface AddFeedsSectionProps {
  feeds: Feed[];
  onAddFeed: (feedId: string) => void;
}

function AddFeedsSection(props: AddFeedsSectionProps) {
  const id = `add-feeds-${createUniqueId()}`;
  const anchor = `--anchor-add-feeds-${++counter}`;
  const [pendingIds, setPendingIds] = createSignal<Set<string>>(new Set<string>());

  const commitSelections = () => {
    const ids = pendingIds();
    if (ids.size > 0) {
      for (const feedId of ids) {
        props.onAddFeed(feedId);
      }
      setPendingIds(new Set<string>());
    }
  };

  const handleToggle = (e: ToggleEvent) => {
    if (e.newState === 'closed') {
      commitSelections();
    }
  };

  const handlePopoverRef = (el: HTMLDivElement) => {
    el.addEventListener('toggle', handleToggle as EventListener);
    onCleanup(() => el.removeEventListener('toggle', handleToggle as EventListener));
  };

  const toggleFeed = (feedId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(feedId)) {
        next.delete(feedId);
      } else {
        next.add(feedId);
      }
      return next;
    });
  };

  return (
    <div class="mt-3 flex justify-center">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        popovertarget={id}
        style={{ 'anchor-name': anchor }}
      >
        <Plus size={14} />
        Add Feeds
      </button>
      <div
        ref={handlePopoverRef}
        id={id}
        popover="auto"
        class="border-base-300 bg-base-100 m-0 w-72 rounded-lg border p-0 shadow-lg"
        style={{
          'position-anchor': anchor,
          'position-area': 'bottom',
          'position-try-fallbacks': 'flip-block, flip-inline, flip-block flip-inline',
          margin: '8px',
        }}
      >
        <FeedPickerDropdown feeds={props.feeds} selectedIds={pendingIds()} onToggle={toggleFeed} />
      </div>
    </div>
  );
}

// --- Feed picker dropdown ---

interface FeedPickerDropdownProps {
  feeds: Feed[];
  selectedIds: Set<string>;
  onToggle: (feedId: string) => void;
}

function FeedPickerDropdown(props: FeedPickerDropdownProps) {
  const showSearch = () => props.feeds.length > 5;
  const [searchQuery, setSearchQuery] = createSignal('');

  const filteredFeeds = () => {
    const query = searchQuery().toLowerCase();
    return props.feeds.filter((feed) => feed.title.toLowerCase().includes(query));
  };

  return (
    <>
      <Show when={showSearch()}>
        <label class="input input-ghost outline-none!">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search feeds..."
            autofocus
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </label>
        <div class="bg-base-300 h-px w-full" />
      </Show>

      <div class="max-h-60 overflow-y-auto p-1">
        <For
          each={filteredFeeds()}
          fallback={<div class="text-base-content/60 py-4 text-center text-sm">No feeds found</div>}
        >
          {(feed) => {
            const isSelected = () => props.selectedIds.has(feed.id);
            return (
              <div
                tabIndex="0"
                class="hover:bg-base-200 focus:ring-primary/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none focus:ring-2"
                classList={{ 'bg-base-200': isSelected() }}
                onClick={() => props.onToggle(feed.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onToggle(feed.id);
                  }
                }}
              >
                <div class="flex w-4 shrink-0 items-center justify-center">
                  <Show when={isSelected()}>
                    <Check size={14} class="text-primary" />
                  </Show>
                </div>
                <Show
                  when={feed.icon}
                  fallback={<Rss size={14} class="text-base-content/40 shrink-0" />}
                >
                  <img src={feed.icon!} alt="" class="h-4 w-4 shrink-0 rounded-sm" loading="lazy" />
                </Show>
                <div class="line-clamp-2 min-w-0 flex-1 text-left text-sm">{feed.title}</div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
