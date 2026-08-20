import type { Feed, FeedTag } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { Check, Plus, Rss, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { feedTagsCollection } from '~/entities/feed-tags';
import { TagsIllustration } from './Icons';

interface TagFeedsTabProps {
  tagId: string;
  feeds: Feed[];
  feedTags: FeedTag[];
}

export function TagFeedsTab({ tagId, feeds, feedTags }: TagFeedsTabProps) {
  const assignedFeedIds = new Set(feedTags.map((ft) => ft.feedId));
  const assignedFeeds = feeds.filter((f) => assignedFeedIds.has(f.id));
  const unassignedFeeds = feeds.filter((f) => !assignedFeedIds.has(f.id));

  const handleAddFeed = (feedId: string) => {
    feedTagsCollection.insert({ id: createId(), userId: '', feedId, tagId });
  };

  const handleRemoveFeed = (feedId: string) => {
    const existing = feedTags.find((ft) => ft.feedId === feedId);
    if (existing) feedTagsCollection.delete(existing.id);
  };

  return (
    <>
      <div className="space-y-1">
        {assignedFeeds.map((feed) => (
          <div
            key={feed.id}
            className="hover:bg-base-200 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
          >
            {feed.icon ? (
              <img src={feed.icon} alt="" className="h-8 w-8 rounded" loading="lazy" />
            ) : (
              <div className="bg-base-200 flex h-8 w-8 items-center justify-center rounded">
                <Rss size={14} className="text-base-content/40" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{feed.title}</p>
              {feed.description && (
                <p className="text-base-content/50 truncate text-xs">{feed.description}</p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={() => handleRemoveFeed(feed.id)}
              aria-label={`Remove ${feed.title}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {unassignedFeeds.length > 0 && (
        <AddFeedsSection feeds={unassignedFeeds} onAddFeed={handleAddFeed} />
      )}
    </>
  );
}

interface TagEmptyStateProps {
  tagId: string;
  feeds: Feed[];
}

export function TagEmptyState({ tagId, feeds }: TagEmptyStateProps) {
  const handleAddFeed = (feedId: string) => {
    feedTagsCollection.insert({ id: createId(), userId: '', feedId, tagId });
  };

  return (
    <div className="py-16 text-center">
      <div className="mb-4 flex justify-center">
        <TagsIllustration />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">Nothing Here Yet</h2>
      <p className="text-base-content/60 mb-6">
        Assign feeds to this tag so their articles appear here.
      </p>
      {feeds.length > 0 ? (
        <AddFeedsSection feeds={feeds} onAddFeed={handleAddFeed} />
      ) : (
        <p className="text-base-content/40 text-sm">
          You don't have any feeds yet. Follow some feeds first.
        </p>
      )}
    </div>
  );
}

interface AddFeedsSectionProps {
  feeds: Feed[];
  onAddFeed: (feedId: string) => void;
}

function AddFeedsSection({ feeds, onAddFeed }: AddFeedsSectionProps) {
  const uid = useId();
  const id = `add-feeds-${uid}`;
  const anchor = `--anchor-add-feeds-${uid}`;
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  const commitSelections = () => {
    if (pendingIds.size > 0) {
      for (const feedId of pendingIds) {
        onAddFeed(feedId);
      }
      setPendingIds(new Set());
    }
  };

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const handleToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') {
        commitSelections();
      }
    };

    el.addEventListener('toggle', handleToggle);
    return () => el.removeEventListener('toggle', handleToggle);
  });

  const toggleFeed = (feedId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(feedId)) next.delete(feedId);
      else next.add(feedId);
      return next;
    });
  };

  return (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        popoverTarget={id}
        style={{ anchorName: anchor } as React.CSSProperties}
      >
        <Plus size={14} />
        Add Feeds
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        className="border-base-300 bg-base-100 m-0 w-72 rounded-lg border p-0 shadow-lg"
        style={{
          positionAnchor: anchor,
          positionArea: 'bottom',
          positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
          margin: '8px',
        } as React.CSSProperties}
      >
        <FeedPickerDropdown feeds={feeds} selectedIds={pendingIds} onToggle={toggleFeed} />
      </div>
    </div>
  );
}

interface FeedPickerDropdownProps {
  feeds: Feed[];
  selectedIds: Set<string>;
  onToggle: (feedId: string) => void;
}

function FeedPickerDropdown({ feeds, selectedIds, onToggle }: FeedPickerDropdownProps) {
  const showSearch = feeds.length > 5;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFeeds = feeds.filter((feed) =>
    feed.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      {showSearch && (
        <>
          <label className="input input-ghost outline-none!">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search feeds..."
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </label>
          <div className="bg-base-300 h-px w-full" />
        </>
      )}

      <div className="max-h-60 overflow-y-auto p-1">
        {filteredFeeds.length === 0 ? (
          <div className="text-base-content/60 py-4 text-center text-sm">No feeds found</div>
        ) : (
          filteredFeeds.map((feed) => {
            const isSelected = selectedIds.has(feed.id);
            return (
              <div
                key={feed.id}
                tabIndex={0}
                className={`hover:bg-base-200 focus:ring-primary/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none focus:ring-2${isSelected ? ' bg-base-200' : ''}`}
                onClick={() => onToggle(feed.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle(feed.id);
                  }
                }}
              >
                <div className="flex w-4 shrink-0 items-center justify-center">
                  {isSelected && <Check size={14} className="text-primary" />}
                </div>
                {feed.icon ? (
                  <img
                    src={feed.icon}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-sm"
                    loading="lazy"
                  />
                ) : (
                  <Rss size={14} className="text-base-content/40 shrink-0" />
                )}
                <div className="line-clamp-2 min-w-0 flex-1 text-left text-sm">{feed.title}</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
