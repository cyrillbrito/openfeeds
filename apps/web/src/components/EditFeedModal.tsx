import type { Feed } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { eq, useLiveQuery } from '@tanstack/solid-db';
import { Link } from '@tanstack/solid-router';
import { createSignal, Match, Show, Suspense, Switch } from 'solid-js';
import { feedTagsCollection } from '~/entities/feed-tags';
import { useTags } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { MultiSelectTag } from './MultiSelectTag';
import { RuleManager } from './RuleManager';

interface EditFeedModalProps {
  controller: (controller: ModalController) => void;
  feed: Feed | null;
}

export function EditFeedModal(props: EditFeedModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-2xl"
      title="Edit Feed"
    >
      <Show when={props.feed}>
        {(feed) => <EditFeedForm feed={feed()} onClose={() => modalController.close()} />}
      </Show>
    </LazyModal>
  );
}

interface EditFeedFormProps {
  feed: Feed;
  onClose: () => void;
}

function EditFeedForm(props: EditFeedFormProps) {
  const tagsQuery = useTags();

  const feedTagsQuery = useLiveQuery((q) =>
    q
      .from({ feedTag: feedTagsCollection })
      .where(({ feedTag }) => eq(feedTag.feedId, props.feed.id)),
  );

  const [activeTab, setActiveTab] = createSignal<'tags' | 'rules'>('tags');

  const currentTagIds = () => (feedTagsQuery() ?? []).map((ft) => ft.tagId);

  const handleSelectionChange = (newIds: string[]) => {
    const currentIds = new Set(currentTagIds());
    const newIdSet = new Set(newIds);
    const feedTags = feedTagsQuery() ?? [];

    // Delete removed tags
    const toDelete = feedTags.filter((ft) => !newIdSet.has(ft.tagId));
    if (toDelete.length > 0) {
      feedTagsCollection.delete(toDelete.map((ft) => ft.id));
    }

    // Insert new tags
    const toInsert = [...newIdSet].filter((tagId) => !currentIds.has(tagId));
    if (toInsert.length > 0) {
      feedTagsCollection.insert(
        toInsert.map((tagId) => ({
          id: createId(),
          userId: '', // Will be set server-side
          feedId: props.feed.id,
          tagId,
        })),
      );
    }
  };

  return (
    <div class="space-y-4">
      {/* Feed Info */}
      <div class="bg-base-200 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <Show when={props.feed.icon}>
            <img
              src={props.feed.icon!}
              alt={`${props.feed.title} icon`}
              class="h-6 w-6 rounded"
              loading="lazy"
            />
          </Show>
          <div>
            <h4 class="font-semibold">{props.feed.title}</h4>
            <Show when={props.feed.description}>
              <p class="text-base-content/70 mt-1 text-sm">{props.feed.description}</p>
            </Show>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div role="tablist" class="tabs tabs-box w-fit">
        <a
          role="tab"
          classList={{
            tab: true,
            'tab-active': activeTab() === 'tags',
          }}
          onClick={() => setActiveTab('tags')}
        >
          Tags
        </a>
        <a
          role="tab"
          classList={{
            tab: true,
            'tab-active': activeTab() === 'rules',
          }}
          onClick={() => setActiveTab('rules')}
        >
          Auto archive Rules
        </a>
      </div>

      {/* Tab Content */}
      <div>
        <Switch>
          <Match when={activeTab() === 'tags'}>
            <Suspense fallback={<div class="loading loading-spinner"></div>}>
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
                  selectedIds={currentTagIds()}
                  onSelectionChange={handleSelectionChange}
                />
              </Show>
            </Suspense>
          </Match>
          <Match when={activeTab() === 'rules'}>
            <RuleManager feedId={props.feed.id} />
          </Match>
        </Switch>
      </div>

      {/* Modal Actions */}
      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()}>
          Done
        </button>
      </div>
    </div>
  );
}
