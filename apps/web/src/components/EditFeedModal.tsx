import type { Feed } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { feedTagsCollection } from '~/entities/feed-tags';
import { useTags } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { MultiSelectTag } from './MultiSelectTag';
import { RuleManager } from './RuleManager';

interface EditFeedModalProps {
  controller: (controller: ModalController) => void;
  feed: Feed | null;
}

export function EditFeedModal({ controller, feed }: EditFeedModalProps) {
  const modalRef = useRef<ModalController>(null!);

  return (
    <LazyModal
      controller={(ctrl) => {
        modalRef.current = ctrl;
        controller(ctrl);
      }}
      className="max-w-2xl"
      title="Edit"
    >
      {feed && <EditFeedForm feed={feed} onClose={() => modalRef.current.close()} />}
    </LazyModal>
  );
}

interface EditFeedFormProps {
  feed: Feed;
  onClose: () => void;
}

function EditFeedForm({ feed, onClose }: EditFeedFormProps) {
  const tags = useTags();

  const { data: feedTagsData } = useLiveQuery(
    (q) =>
      q.from({ feedTag: feedTagsCollection }).where(({ feedTag }) => eq(feedTag.feedId, feed.id)),
    [feed.id],
  );
  const feedTags = (feedTagsData ?? []) as typeof feedTagsData & { tagId: string; id: string }[];

  const [activeTab, setActiveTab] = useState<'tags' | 'rules'>('tags');

  const currentTagIds = feedTags.map((ft) => ft.tagId);

  const handleSelectionChange = (newIds: string[]) => {
    const currentIds = new Set(currentTagIds);
    const newIdSet = new Set(newIds);

    const toDelete = feedTags.filter((ft) => !newIdSet.has(ft.tagId));
    if (toDelete.length > 0) {
      feedTagsCollection.delete(toDelete.map((ft) => ft.id));
    }

    const toInsert = [...newIdSet].filter((tagId) => !currentIds.has(tagId));
    if (toInsert.length > 0) {
      feedTagsCollection.insert(
        toInsert.map((tagId) => ({
          id: createId(),
          userId: '',
          feedId: feed.id,
          tagId,
        })),
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Feed Info */}
      <div className="bg-base-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          {feed.icon && (
            <img
              src={feed.icon}
              alt={`${feed.title} icon`}
              className="h-6 w-6 rounded"
              loading="lazy"
            />
          )}
          <div>
            <h4 className="font-semibold">{feed.title}</h4>
            {feed.description && (
              <p className="text-base-content/70 mt-1 text-sm">{feed.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div role="tablist" className="tabs tabs-box w-fit">
        <a
          role="tab"
          className={`tab${activeTab === 'tags' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          Tags
        </a>
        <a
          role="tab"
          className={`tab${activeTab === 'rules' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Auto archive Rules
        </a>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'tags' ? (
          tags.length > 0 ? (
            <MultiSelectTag
              tags={tags}
              selectedIds={currentTagIds}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-base-content/60 mb-4">No tags available.</p>
              <Link to="/tags" className="btn btn-primary btn-sm">
                Create Tags
              </Link>
            </div>
          )
        ) : (
          <RuleManager feedId={feed.id} />
        )}
      </div>

      {/* Modal Actions */}
      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
