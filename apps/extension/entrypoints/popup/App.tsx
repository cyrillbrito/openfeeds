import logoUrl from '@/assets/logo.svg';
import { initTheme } from '@/utils/theme';
import type { DiscoveredFeed, MessageType } from '@/utils/types';
import { createSignal, For, Match, onMount, Switch } from 'solid-js';
import './App.css';

type PopupState = 'loading' | 'no-feeds' | 'feeds-list' | 'error';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

function formatFeedType(type: string | undefined): string {
  if (!type || type === 'potential') return 'Feed';
  if (type.includes('rss')) return 'RSS';
  if (type.includes('atom')) return 'Atom';
  if (type.includes('json')) return 'JSON Feed';
  return 'Feed';
}

function FeedItem(props: { feed: DiscoveredFeed }) {
  const [buttonState, setButtonState] = createSignal<ButtonState>('idle');

  async function handleFollow(): Promise<void> {
    setButtonState('loading');

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'FOLLOW_FEED',
        feed: props.feed,
      } as MessageType)) as { type: 'FOLLOW_RESULT'; success: boolean; error?: string };

      if (response.success) {
        setButtonState('success');
      } else {
        setButtonState('error');
        setTimeout(() => setButtonState('idle'), 2000);
      }
    } catch (error) {
      console.error('Failed to follow feed:', error);
      setButtonState('error');
      setTimeout(() => setButtonState('idle'), 2000);
    }
  }

  return (
    <li class="border-base-300 flex items-center justify-between gap-3 rounded-lg border p-3">
      <div class="min-w-0 flex-1">
        <div class="text-base-content truncate font-medium" title={props.feed.title}>
          {props.feed.title}
        </div>
        <div class="text-base-content/60 mt-0.5 flex items-center gap-1.5 text-xs">
          <span>{formatFeedType(props.feed.type)}</span>
          <span class="text-base-content/30">•</span>
          <a
            href={props.feed.url}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-hover truncate"
            title={props.feed.url}
          >
            {props.feed.url}
          </a>
        </div>
      </div>
      <button
        class="btn btn-primary btn-sm"
        classList={{
          'btn-success': buttonState() === 'success',
          'btn-error': buttonState() === 'error',
        }}
        disabled={buttonState() === 'loading' || buttonState() === 'success'}
        onClick={handleFollow}
      >
        <Switch>
          <Match when={buttonState() === 'idle'}>Follow</Match>
          <Match when={buttonState() === 'loading'}>
            <span class="loading loading-spinner loading-xs" />
          </Match>
          <Match when={buttonState() === 'success'}>Added!</Match>
          <Match when={buttonState() === 'error'}>Failed</Match>
        </Switch>
      </button>
    </li>
  );
}

export function App() {
  const [state, setState] = createSignal<PopupState>('loading');
  const [feeds, setFeeds] = createSignal<DiscoveredFeed[]>([]);
  const [errorMessage, setErrorMessage] = createSignal('');

  onMount(async () => {
    await initTheme();

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setErrorMessage('Could not access current tab');
        setState('error');
        return;
      }

      const response = (await browser.tabs.sendMessage(tab.id, {
        type: 'GET_FEEDS',
      } as MessageType)) as { type: 'FEEDS_RESULT'; feeds: DiscoveredFeed[] };

      const detectedFeeds = response?.feeds || [];

      if (detectedFeeds.length === 0) {
        setState('no-feeds');
        return;
      }

      setFeeds(detectedFeeds);
      setState('feeds-list');
    } catch {
      setState('no-feeds');
    }
  });

  return (
    <div class="flex min-h-[200px] flex-col">
      <header class="border-base-300 bg-base-200 flex items-center justify-between border-b px-4 py-3">
        <div class="flex items-center gap-2">
          <img src={logoUrl} class="h-6 w-8" alt="OpenFeeds logo" />
          <h1 class="text-base font-semibold">OpenFeeds</h1>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square"
          onClick={() => browser.runtime.openOptionsPage()}
          title="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </header>

      <main class="flex-1 p-4">
        <Switch>
          <Match when={state() === 'loading'}>
            <div class="flex items-center justify-center py-6">
              <span class="loading loading-spinner loading-md" />
              <span class="text-base-content/60 ml-2">Detecting feeds...</span>
            </div>
          </Match>

          <Match when={state() === 'no-feeds'}>
            <div class="py-6 text-center">
              <p class="text-base-content/60">No RSS feeds found on this page.</p>
              <p class="text-base-content/40 mt-2 text-xs">Try visiting a blog or news site.</p>
            </div>
          </Match>

          <Match when={state() === 'feeds-list'}>
            <p class="text-base-content/60 mb-3 text-xs">
              Found {feeds().length} feed{feeds().length === 1 ? '' : 's'}
            </p>
            <ul class="space-y-2">
              <For each={feeds()}>{(feed) => <FeedItem feed={feed} />}</For>
            </ul>
          </Match>

          <Match when={state() === 'error'}>
            <div class="bg-error/10 text-error rounded-lg p-3 text-sm">{errorMessage()}</div>
          </Match>
        </Switch>
      </main>
    </div>
  );
}
