import type { Feed, TagColor } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { eq, toArray, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute, Link } from '@tanstack/react-router';
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
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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
import { tagsCollection, useTags } from '~/entities/tags';
import { api, unwrap } from '~/lib/api-client';
import { getTagDotColor } from '~/utils/tagColors';

const SEARCH_DEBOUNCE_MS = 200;

type FeedWithTags = Feed & {
  tags: {
    feedTagId: string;
    id: string | undefined;
    name: string | undefined;
    color: TagColor | null | undefined;
  }[];
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
  const { data: feedsWithTagsData } = useLiveQuery((q) =>
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

  const importOpmlModalRef = useRef<ModalController>(null!);
  const deleteFeedModalRef = useRef<ModalController>(null!);
  const editFeedModalRef = useRef<ModalController>(null!);
  const syncLogsModalRef = useRef<ModalController>(null!);
  const bulkRetryModalRef = useRef<ModalController>(null!);
  const bulkAddTagsModalRef = useRef<ModalController>(null!);

  const [feedsToDelete, setFeedsToDelete] = useState<FeedWithTags[]>([]);
  const [editingFeed, setEditingFeed] = useState<FeedWithTags | null>(null);
  const [syncLogsFeed, setSyncLogsFeed] = useState<FeedWithTags | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelecting = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set<string>());

  const [searchDebounced, setSearchDebounced] = useState(search?.q ?? '');

  const setSearchDebounce = useDebouncedCallback((value: string) => {
    const newQ = value.toLowerCase().trim();
    void navigate({
      search: newQ ? { q: newQ } : {},
      replace: true,
    });
    setSearchDebounced(newQ);
    clearSelection();
  }, SEARCH_DEBOUNCE_MS);

  const filteredFeeds = useMemo<FeedWithTags[]>(() => {
    const feeds = feedsWithTagsData as FeedWithTags[] | undefined;
    if (!feeds) return [];

    let result: FeedWithTags[] = feeds;
    if (searchDebounced) {
      result = result.filter(
        (feed) =>
          feed.title.toLowerCase().includes(searchDebounced) ||
          feed.description?.toLowerCase().includes(searchDebounced) ||
          feed.url.toLowerCase().includes(searchDebounced),
      );
    }

    const statusOrder: Record<string, number> = { broken: 0, failing: 1, ok: 2 };
    return result.toSorted(
      (a, b) => (statusOrder[a.syncStatus ?? 'ok'] ?? 0) - (statusOrder[b.syncStatus ?? 'ok'] ?? 0),
    );
  }, [feedsWithTagsData, searchDebounced]);

  const isAllSelected = filteredFeeds.length > 0 && selectedIds.size === filteredFeeds.length;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFeeds.length) {
      setSelectedIds(new Set<string>());
    } else {
      setSelectedIds(new Set<string>(filteredFeeds.map((f) => f.id)));
    }
  };

  const handleBulkDelete = () => {
    setFeedsToDelete(filteredFeeds.filter((f) => selectedIds.has(f.id)));
    deleteFeedModalRef.current.open();
  };

  const handleBulkRetry = () => {
    bulkRetryModalRef.current.open();
  };

  const handleBulkAddTags = () => {
    bulkAddTagsModalRef.current.open();
  };

  const executeBulkRetry = () => {
    for (const feed of filteredFeeds) {
      if (selectedIds.has(feed.id) && (feed.syncStatus === 'failing' || feed.syncStatus === 'broken')) {
        feedsCollection.update(feed.id, (draft) => {
          draft.syncStatus = 'ok';
          draft.syncError = null;
        });
        void unwrap(api.api.feeds.retry.$post({ json: { id: feed.id } }));
      }
    }
    clearSelection();
  };

  const selectedFailingCount = filteredFeeds.filter(
    (f) => selectedIds.has(f.id) && (f.syncStatus === 'failing' || f.syncStatus === 'broken'),
  ).length;

  const feedsWithTagsLoaded = feedsWithTagsData !== undefined;

  return (
    <PageLayout title="Feeds" mobileOnlyTitle>
      <ImportOpmlModal
        controller={(c) => {
          importOpmlModalRef.current = c;
        }}
      />

      <DeleteFeedModal
        controller={(c) => {
          deleteFeedModalRef.current = c;
        }}
        feeds={feedsToDelete}
        onDeleteComplete={() => {
          setFeedsToDelete([]);
          clearSelection();
        }}
      />

      <EditFeedModal
        controller={(c) => {
          editFeedModalRef.current = c;
        }}
        feed={editingFeed}
      />

      <SyncLogsModal
        controller={(c) => {
          syncLogsModalRef.current = c;
        }}
        feed={syncLogsFeed}
      />

      <BulkRetryModal
        controller={(c) => {
          bulkRetryModalRef.current = c;
        }}
        failingCount={selectedFailingCount}
        onConfirm={() => {
          executeBulkRetry();
          bulkRetryModalRef.current.close();
        }}
      />

      <BulkAddTagsModal
        controller={(c) => {
          bulkAddTagsModalRef.current = c;
        }}
        selectedFeedIds={filteredFeeds.filter((f) => selectedIds.has(f.id)).map((f) => f.id)}
        feedTags={feedTagsQuery}
        onComplete={clearSelection}
      />

      {!feedsWithTagsLoaded ? (
        <CenterLoader />
      ) : feedsWithTagsData!.length === 0 ? (
        <FeedsEmptyState onImportOpml={() => importOpmlModalRef.current.open()} />
      ) : (
        <>
          <FeedsHeader
            searchValue={searchDebounced}
            onSearchChange={setSearchDebounce}
            onImportOpml={() => importOpmlModalRef.current.open()}
          />

          {filteredFeeds.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mb-4">
                <CircleAlert size={64} className="text-base-content/30 mx-auto" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">No feeds found</h2>
              <p className="text-base-content-gray">
                No feeds match your search query "{search?.q}"
              </p>
              <button className="btn btn-outline mt-4" onClick={() => setSearchDebounce('')}>
                Clear search
              </button>
            </div>
          ) : (
            <>
              <div className="group/header mt-4 flex h-8 items-center gap-3 px-2 pb-2 md:gap-4">
                <div className="flex w-8 shrink-0 items-center justify-center md:w-10">
                  <input
                    type="checkbox"
                    className={`checkbox checkbox-sm transition-opacity ${isSelecting ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </div>

                {isSelecting ? (
                  <>
                    <span className="text-sm font-medium">{selectedIds.size} selected</span>

                    <div className="flex items-center gap-1">
                      {selectedFailingCount > 0 && (
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={handleBulkRetry}
                          title="Retry failed feeds"
                        >
                          <RefreshCw size={14} />
                          <span className="hidden sm:inline">Retry</span>
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-xs gap-1"
                        onClick={handleBulkAddTags}
                        title="Add tags to selected feeds"
                      >
                        <Tag size={14} />
                        <span className="hidden sm:inline">Tag</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error gap-1"
                        onClick={handleBulkDelete}
                        title="Unfollow selected feeds"
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Unfollow</span>
                      </button>
                    </div>

                    <button
                      className="btn btn-ghost btn-xs btn-circle ml-auto"
                      onClick={clearSelection}
                      title="Exit selection"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <span className="text-base-content/40 text-sm">
                    {filteredFeeds.length} feed{filteredFeeds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div>
                {filteredFeeds.map((feed, i) => (
                  <>
                    {i > 0 && <hr key={`divider-${feed.id}`} className="border-base-content/8 mx-4" />}
                    <FeedRow
                      key={feed.id}
                      feed={feed}
                      selected={selectedIds.has(feed.id)}
                      onToggleSelect={() => toggleSelect(feed.id)}
                      onEdit={() => {
                        setEditingFeed(feed);
                        editFeedModalRef.current.open();
                      }}
                      onDelete={() => {
                        setFeedsToDelete([feed]);
                        deleteFeedModalRef.current.open();
                      }}
                      onRetry={() => {
                        feedsCollection.update(feed.id, (draft) => {
                          draft.syncStatus = 'ok';
                          draft.syncError = null;
                        });
                        void unwrap(api.api.feeds.retry.$post({ json: { id: feed.id } }));
                      }}
                      onViewLogs={() => {
                        setSyncLogsFeed(feed);
                        syncLogsModalRef.current.open();
                      }}
                    />
                  </>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}

interface FeedsEmptyStateProps {
  onImportOpml: () => void;
}

function FeedsEmptyState({ onImportOpml }: FeedsEmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="mb-6 flex justify-center">
        <div className="bg-base-300/60 flex size-24 items-center justify-center rounded-full">
          <Rss size={40} className="text-base-content/30 translate-x-1 -translate-y-0.5" />
        </div>
      </div>

      <h2 className="mb-2 text-2xl font-bold">No Feeds Yet</h2>
      <p className="text-base-content/60 mx-auto mb-8 max-w-sm">
        Follow your favorite sources to get started.
      </p>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <button className="btn btn-outline" onClick={onImportOpml}>
          <CloudDownload size={18} />
          Import OPML
        </button>
        <Link to="/discover" className="btn btn-primary">
          <Plus size={18} />
          Discover
        </Link>
      </div>
    </div>
  );
}

interface FeedsHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onImportOpml: () => void;
}

function FeedsHeader({ searchValue, onSearchChange, onImportOpml }: FeedsHeaderProps) {
  return (
    <div className="sm:py-4">
      <div className="mb-4 hidden items-center justify-between sm:flex">
        <h2 className="text-2xl font-bold sm:text-3xl">Feeds</h2>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={onImportOpml}>
            <CloudDownload size={18} />
            Import OPML
          </button>
          <Link to="/discover" className="btn btn-primary btn-sm">
            <Plus size={18} />
            Discover
          </Link>
        </div>
      </div>

      <p className="text-base-content/60 mb-4">View and organize your feeds</p>

      <div className="mb-3 flex gap-2 sm:hidden">
        <button className="btn btn-outline btn-sm" onClick={onImportOpml}>
          <CloudDownload size={18} />
          Import OPML
        </button>
        <Link to="/discover" className="btn btn-primary btn-sm">
          <Plus size={18} />
          Discover
        </Link>
      </div>

      <label className="input input-bordered flex w-full max-w-md items-center gap-2">
        <Search size={20} className="opacity-50" />
        <input
          type="search"
          placeholder="Search feeds..."
          className="grow"
          defaultValue={searchValue}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}

interface BulkRetryModalProps {
  controller: (controller: ModalController) => void;
  failingCount: number;
  onConfirm: () => void;
}

function BulkRetryModal({ controller, failingCount, onConfirm }: BulkRetryModalProps) {
  const modalRef = useRef<ModalController>(null!);

  return (
    <LazyModal
      controller={(c) => {
        modalRef.current = c;
        controller(c);
      }}
      className="max-w-sm"
      title="Retry sync?"
    >
      <p className="text-base-content/70 text-sm">
        <span className="text-base-content font-medium">{failingCount}</span> failing feed
        {failingCount !== 1 ? 's' : ''} will be cleared and retried.
      </p>

      <div className="modal-action">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => modalRef.current.close()}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
          Retry
        </button>
      </div>
    </LazyModal>
  );
}

interface BulkAddTagsModalProps {
  controller: (controller: ModalController) => void;
  selectedFeedIds: string[];
  feedTags: ReturnType<typeof useFeedTags>;
  onComplete: () => void;
}

function BulkAddTagsModal({ controller, selectedFeedIds, feedTags, onComplete }: BulkAddTagsModalProps) {
  const modalRef = useRef<ModalController>(null!);
  const tags = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const handleApply = () => {
    const existingFeedTags = feedTags ?? [];

    for (const feedId of selectedFeedIds) {
      const existingTagIds = new Set(
        existingFeedTags.filter((ft) => ft.feedId === feedId).map((ft) => ft.tagId),
      );

      const toInsert = selectedTagIds.filter((tagId) => !existingTagIds.has(tagId));
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
    modalRef.current.close();
    onComplete();
  };

  return (
    <LazyModal
      controller={(c) => {
        modalRef.current = c;
        controller(c);
      }}
      className="max-w-md"
      title="Add Tags"
      onClose={() => setSelectedTagIds([])}
    >
      <div className="mb-6">
        <p className="text-base-content/60 mb-4 text-sm">
          Add tags to{' '}
          <span className="text-base-content font-semibold">
            {selectedFeedIds.length} selected feed
            {selectedFeedIds.length !== 1 ? 's' : ''}
          </span>
          . Existing tags on each feed will be kept.
        </p>

        {tags.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base-content/60 mb-4">No tags available.</p>
            <Link to="/tags" className="btn btn-primary btn-sm">
              Create Tags
            </Link>
          </div>
        ) : (
          <MultiSelectTag
            tags={tags}
            selectedIds={selectedTagIds}
            onSelectionChange={setSelectedTagIds}
          />
        )}
      </div>

      <div className="modal-action">
        <button type="button" className="btn" onClick={() => modalRef.current.close()}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedTagIds.length === 0}
          onClick={handleApply}
        >
          Add {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''}
        </button>
      </div>
    </LazyModal>
  );
}

function FeedIcon({ feed }: { feed: FeedWithTags }) {
  const [iconError, setIconError] = useState(false);

  return feed.icon && !iconError ? (
    <img
      src={feed.icon}
      alt={feed.title}
      className="bg-base-300 size-8 rounded-full object-cover md:size-10"
      loading="lazy"
      draggable={false}
      onError={() => setIconError(true)}
    />
  ) : (
    <div className="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
      <Rss size={14} className="text-base-content/50 md:size-4" />
    </div>
  );
}

interface FeedRowProps {
  feed: FeedWithTags;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onViewLogs: () => void;
}

function FeedRow({ feed, selected, onToggleSelect, onEdit, onDelete, onRetry, onViewLogs }: FeedRowProps) {
  return (
    <div
      className={`hover:bg-base-200/50 group relative flex items-start gap-3 rounded-lg px-2 py-3 transition-colors md:gap-4 md:py-4${selected ? ' bg-base-200/30' : ''}`}
    >
      <AvatarCheckbox selected={selected} onToggle={onToggleSelect} className="pt-0.5">
        <FeedIcon feed={feed} />
      </AvatarCheckbox>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to="/feeds/$feedId"
            params={{ feedId: feed.id }}
            search={{ readStatus: 'unread' }}
            className="min-w-0"
          >
            <h3 className="hover:text-primary truncate text-sm font-medium transition-colors md:text-base">
              {feed.title}
            </h3>
          </Link>
          {(feed.syncStatus === 'failing' || feed.syncStatus === 'broken') && (
            <span
              className={`badge badge-xs ${feed.syncStatus === 'broken' ? 'badge-error' : 'badge-warning'}`}
            >
              {feed.syncStatus === 'broken' ? 'Broken' : 'Failing'}
            </span>
          )}
        </div>

        {feed.description && (
          <p className="text-base-content/50 mt-0.5 line-clamp-3 text-xs leading-relaxed md:text-sm">
            {feed.description}
          </p>
        )}

        {feed.tags && feed.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {feed.tags.map((tag) => (
              <Link key={tag.feedTagId} to="/tags/$tagId" params={{ tagId: tag.id! }}>
                <span className="badge badge-xs gap-1 transition-all hover:brightness-90">
                  <ColorIndicator className={getTagDotColor(tag.color ?? null)} />
                  {tag.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 pt-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <Dropdown
          end
          btnClasses="btn-circle btn-ghost btn-sm"
          btnContent={<EllipsisVertical size={18} />}
        >
          <li>
            <button onClick={onEdit}>Edit</button>
          </li>
          {(feed.syncStatus === 'failing' || feed.syncStatus === 'broken') && (
            <li>
              <button onClick={onRetry}>Retry Sync</button>
            </li>
          )}
          <li>
            <button onClick={onViewLogs}>Sync Logs</button>
          </li>
          <div className="divider my-0"></div>
          <li>
            <button className="text-error w-full text-left" onClick={onDelete}>
              Unfollow
            </button>
          </li>
        </Dropdown>
      </div>
    </div>
  );
}
