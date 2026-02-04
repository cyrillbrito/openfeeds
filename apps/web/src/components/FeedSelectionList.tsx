import type { DiscoveredFeed } from '@repo/domain/client';
import { createSignal, For, Show } from 'solid-js';
import { CenterLoader } from './Loader';

interface FeedSelectionListProps {
  feeds: DiscoveredFeed[];
  onSelect: (selectedFeed: DiscoveredFeed) => void;
  isLoading?: boolean;
}

export function FeedSelectionList(props: FeedSelectionListProps) {
  const [selectedFeedUrl, setSelectedFeedUrl] = createSignal<string>('');

  const handleSelection = (feed: DiscoveredFeed) => {
    setSelectedFeedUrl(feed.url);
    props.onSelect(feed);
  };

  return (
    <div class="form-control">
      <label class="label">
        <span class="label-text">Select a feed to add:</span>
      </label>

      <Show when={props.feeds.length === 0 && !props.isLoading}>
        <div class="alert alert-warning">
          <span>No RSS feeds were found at this URL. You can try adding the URL directly.</span>
        </div>
      </Show>

      <Show when={props.feeds.length > 0}>
        <div class="space-y-2">
          <For each={props.feeds}>
            {(feed) => (
              <label class="border-base-300 hover:bg-base-200 flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="feed-selection"
                  class="radio radio-primary"
                  value={feed.url}
                  checked={selectedFeedUrl() === feed.url}
                  onChange={() => handleSelection(feed)}
                  disabled={props.isLoading}
                />
                <div class="flex-1">
                  <div class="font-medium">{feed.title}</div>
                  <div class="text-base-content/70 text-sm break-all">{feed.url}</div>
                  <Show when={feed.type}>
                    <div class="badge badge-sm badge-outline mt-1">{feed.type}</div>
                  </Show>
                </div>
              </label>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.isLoading}>
        <CenterLoader />
      </Show>
    </div>
  );
}
