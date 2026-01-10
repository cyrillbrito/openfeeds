import type { DiscoveredFeed } from '@repo/shared/types';
import { createId } from '@repo/shared/utils';
import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import { createSignal, For, Show } from 'solid-js';
import { discoverFeeds, feedsCollection } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { MultiSelectTag } from './MultiSelectTag';

interface AddFeedModalProps {
  controller: (controller: ModalController) => void;
}

type ModalStep = 'url-input' | 'feed-selection';

export function AddFeedModal(props: AddFeedModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      title="Add New RSS Feed"
    >
      <AddFeedForm onClose={() => modalController.close()} />
    </LazyModal>
  );
}

interface AddFeedFormProps {
  onClose: () => void;
}

function AddFeedForm(props: AddFeedFormProps) {
  console.log(`🎯 AddFeedForm: FRESH component created! Timestamp: ${Date.now()}`);

  const [isDiscovering, setIsDiscovering] = createSignal(false);

  const [feedUrl, setFeedUrl] = createSignal('');
  const [currentStep, setCurrentStep] = createSignal<ModalStep>('url-input');
  const [discoveredFeeds, setDiscoveredFeeds] = createSignal<DiscoveredFeed[]>([]);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [feedTagSelections, setFeedTagSelections] = createSignal<Record<string, string[]>>({});
  const [addedFeeds, setAddedFeeds] = createSignal(new Set<string>());
  const [error, setError] = createSignal<string | null>(null);

  const tagsQuery = useTags();

  const handleDiscoverFeeds = async (e: Event) => {
    e.preventDefault();
    const url = feedUrl().trim();

    if (!url) {
      setError('Please enter a valid URL');
      return;
    }

    try {
      setError(null);
      setIsDiscovering(true);
      const data = await discoverFeeds(url);

      setDiscoveredFeeds(data);

      if (data.length === 0) {
        setError('No RSS feeds found at this URL. You can try adding the URL directly.');
      }

      setCurrentStep('feed-selection');
    } catch (err) {
      console.error('Failed to discover feeds:', err);
      setError(err instanceof Error ? err.message : 'Failed to discover feeds');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddFeed = (feed: DiscoveredFeed) => {
    const tags = feedTagSelections()[feed.url] || selectedTags();

    feedsCollection.insert({
      id: createId(),
      url: feed.url,
      feedUrl: feed.url,
      title: feed.title || feed.url,
      description: null,
      icon: null,
      createdAt: new Date().toISOString(),
      lastSyncAt: null,
      tags,
    });

    setAddedFeeds((prev) => new Set([...prev, feed.url]));

    if (discoveredFeeds().length === 1) {
      props.onClose();
    }
  };

  const handleAddManually = () => {
    const url = feedUrl().trim();

    feedsCollection.insert({
      id: createId(),
      url,
      feedUrl: url,
      title: url,
      description: null,
      icon: null,
      createdAt: new Date().toISOString(),
      lastSyncAt: null,
      tags: selectedTags(),
    });

    props.onClose();
  };

  return (
    <>
      <Show when={currentStep() === 'url-input'}>
        <form onSubmit={handleDiscoverFeeds}>
          <div class="form-control mb-4 w-full">
            <label class="label">
              <span class="label-text">Website or RSS Feed URL</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com or https://example.com/rss.xml"
              class="input input-bordered w-full"
              value={feedUrl()}
              onInput={(e) => setFeedUrl(e.currentTarget.value)}
              required
            />
            <label class="label">
              <span class="label-text-alt">
                Enter any website URL to find RSS feeds automatically
              </span>
            </label>
          </div>

          <Show when={error()}>
            <div class="alert alert-error mb-4">
              <CircleAlertIcon size={20} />
              <span>{error()}</span>
            </div>
          </Show>

          <div class="modal-action">
            <button
              type="button"
              class="btn"
              onClick={() => props.onClose()}
              disabled={isDiscovering()}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={isDiscovering()}>
              <Show when={isDiscovering()}>
                <span class="loading loading-spinner"></span>
              </Show>
              {isDiscovering() ? 'Finding Feeds...' : 'Find Feeds'}
            </button>
          </div>
        </form>
      </Show>

      <Show when={currentStep() === 'feed-selection'}>
        <div class="space-y-4">
          {/* Single Feed Found */}
          <Show when={discoveredFeeds().length === 1}>
            <div class="space-y-4">
              <div class="alert alert-success">
                <span>✓ Found feed!</span>
              </div>

              <div class="card bg-base-200 p-4">
                <div class="font-medium">{discoveredFeeds()[0].title}</div>
                <div class="text-base-content/70 mt-1 text-sm break-all">
                  {discoveredFeeds()[0].url}
                </div>
                <Show when={discoveredFeeds()[0].type}>
                  <div class="badge badge-sm badge-outline mt-2">{discoveredFeeds()[0].type}</div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Multiple Feeds Found */}
          <Show when={discoveredFeeds().length > 1}>
            <div class="space-y-4">
              <div class="alert alert-info">
                <span>Found {discoveredFeeds().length} feeds</span>
              </div>

              <div class="space-y-4">
                <For each={discoveredFeeds()}>
                  {(feed) => {
                    const isAdded = () => addedFeeds().has(feed.url);

                    return (
                      <div class="card bg-base-200 space-y-3 p-4">
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="text-base-content/70 text-sm break-all">{feed.url}</div>
                            <Show when={feed.type}>
                              <div class="badge badge-sm badge-outline mt-1">{feed.type}</div>
                            </Show>
                          </div>

                          <Show when={!isAdded()}>
                            <button
                              type="button"
                              class="btn btn-primary btn-sm ml-4"
                              onClick={() => handleAddFeed(feed)}
                            >
                              Add
                            </button>
                          </Show>

                          <Show when={isAdded()}>
                            <div class="badge badge-success">Added</div>
                          </Show>
                        </div>

                        {/* Per-feed tag selector */}
                        <Show when={tagsQuery.data && tagsQuery.data.length > 0 && !isAdded()}>
                          <MultiSelectTag
                            tags={tagsQuery.data || []}
                            selectedIds={feedTagSelections()[feed.url] || []}
                            onSelectionChange={(ids) =>
                              setFeedTagSelections((prev) => ({
                                ...prev,
                                [feed.url]: ids,
                              }))
                            }
                          />
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          {/* No Feeds Found */}
          <Show when={discoveredFeeds().length === 0}>
            <div class="alert alert-warning">
              <span>No RSS feeds found at this URL. You can try adding the URL directly.</span>
            </div>
          </Show>

          {/* Tag Selection - only show for single feed */}
          <Show
            when={tagsQuery.data && tagsQuery.data.length > 0 && discoveredFeeds().length === 1}
          >
            <MultiSelectTag
              tags={tagsQuery.data || []}
              selectedIds={selectedTags()}
              onSelectionChange={setSelectedTags}
            />
          </Show>

          <Show when={error()}>
            <div class="alert alert-error">
              <CircleAlertIcon size={20} />
              <span>{error()}</span>
            </div>
          </Show>

          <div class="modal-action">
            <button type="button" class="btn" onClick={() => setCurrentStep('url-input')}>
              Back
            </button>

            <Show when={discoveredFeeds().length === 0}>
              <button type="button" class="btn btn-secondary" onClick={handleAddManually}>
                Add URL Directly
              </button>
            </Show>

            <Show when={discoveredFeeds().length === 1}>
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => handleAddFeed(discoveredFeeds()[0])}
              >
                Add Feed
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
}
