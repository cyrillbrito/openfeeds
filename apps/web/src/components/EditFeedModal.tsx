import type { Feed } from '@repo/shared/types';
import { Link } from '@tanstack/solid-router';
import { updateFeed } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { createEffect, createMemo, createSignal, Match, Show, Suspense, Switch } from 'solid-js';
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
      class="max-w-4xl"
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
  console.log(
    `🎯 EditFeedForm: FRESH component created! Feed: ${props.feed.title}. Timestamp: ${Date.now()}`,
  );

  const tagsQuery = useTags();

  const [activeTab, setActiveTab] = createSignal<'tags' | 'rules'>('tags');
  const [isUpdatingTags, setIsUpdatingTags] = createSignal(false);
  const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);

  // Initialize selected tags when component is created
  createEffect(() => {
    setSelectedTagIds([...props.feed.tags]);
  });

  const handleUpdateTags = async () => {
    if (isUpdatingTags()) return;

    try {
      setIsUpdatingTags(true);
      await updateFeed(props.feed.id, {
        tags: selectedTagIds(),
      });
    } catch (err) {
      console.error('Failed to update tags:', err);
    } finally {
      setIsUpdatingTags(false);
    }
  };

  const hasTagChanges = createMemo(() => {
    const current = selectedTagIds()
      .slice()
      .sort((a, b) => a - b);
    const original = props.feed.tags.slice().sort((a, b) => a - b);

    if (current.length !== original.length) return true;
    return current.some((id, index) => id !== original[index]);
  });

  return (
    <div class="space-y-6">
      {/* Feed Info */}
      <div class="bg-base-200 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <Show when={props.feed.icon}>
            <img src={props.feed.icon!} alt={`${props.feed.title} icon`} class="h-6 w-6 rounded" />
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
      <div class="min-h-[400px]">
        <Switch>
          <Match when={activeTab() === 'tags'}>
            <div class="space-y-4">
              <div>
                <h3 class="mb-2 text-lg font-semibold">Manage Tags</h3>
                <p class="text-base-content/70 text-sm">
                  Assign tags to organize and categorize this feed
                </p>
              </div>

              <Suspense fallback={<div class="loading loading-spinner"></div>}>
                <Show
                  when={tagsQuery.data && tagsQuery.data.length > 0}
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
                    tags={tagsQuery.data!}
                    selectedIds={selectedTagIds()}
                    onSelectionChange={setSelectedTagIds}
                    disabled={isUpdatingTags()}
                  />

                  <Show when={hasTagChanges()}>
                    <div class="border-base-300 flex justify-end border-t pt-4">
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          onClick={() => setSelectedTagIds([...props.feed.tags])}
                          disabled={isUpdatingTags()}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          onClick={handleUpdateTags}
                          disabled={isUpdatingTags()}
                        >
                          <Show when={isUpdatingTags()} fallback="Save Tags">
                            <span class="loading loading-spinner loading-sm"></span>
                            Saving...
                          </Show>
                        </button>
                      </div>
                    </div>
                  </Show>
                </Show>
              </Suspense>
            </div>
          </Match>
          <Match when={activeTab() === 'rules'}>
            <RuleManager feedId={props.feed.id} />
          </Match>
        </Switch>
      </div>

      {/* Modal Actions */}
      <div class="modal-action">
        <button
          type="button"
          class="btn"
          onClick={() => props.onClose()}
          disabled={isUpdatingTags()}
        >
          Done
        </button>
      </div>
    </div>
  );
}
